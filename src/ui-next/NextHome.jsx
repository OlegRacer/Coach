import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import EditFab from '../components/EditFab.jsx';
import ScheduleWidget from '../components/ScheduleWidget.jsx';
import useOnline from '../lib/useOnline.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { orderIds, useEditing, useWidgets } from '../lib/widgets.js';
import SectionTile from '../components/SectionIcon.jsx';
import { supabase } from '../lib/supabase.js';

// Головна нового інтерфейсу: віджети (розклад і розділи). Довгий тап або «+» → «Редагувати віджети»:
// пунктирні рамки, «−» ховає віджет, смужка праворуч перетягує, «Готово» завершує, «+» над ним повертає сховані.
export default function NextHome() {
  const { t, locale } = useI18n();
  const online = useOnline();
  const { isAdmin, access } = useAuth();
  const { sections, sectionOpen, openCount, isFreeSection, reload } = useContent();
  const L = useL();
  const w = useWidgets();
  const navigate = useNavigate();
  // Перехід «з іконки»: сторінка розкривається з прямокутника плитки (View Transitions; без підтримки — звичайний перехід)
  const zoomTo = (e, to) => {
    if (editing || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const el = document.documentElement;
    const W = window.innerWidth;
    const H = window.innerHeight;
    el.style.setProperty('--vt-t', Math.max(0, r.top) + 'px');
    el.style.setProperty('--vt-l', Math.max(0, r.left) + 'px');
    el.style.setProperty('--vt-r', Math.max(0, W - r.right) + 'px');
    el.style.setProperty('--vt-b', Math.max(0, H - r.bottom) + 'px');
    el.dataset.vt = 'zoom';
    const t = document.startViewTransition(() => {
      flushSync(() => navigate(to));
    });
    const done = () => delete el.dataset.vt;
    t.finished.then(done, done);
  };
  const [editing, setEditing] = useEditing();
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState(null);
  const last = useRef(0);

  const allIds = ['schedule', 'schedule:mine', ...sections.map((x) => 'sec:' + x.id)];
  const ids = orderIds(allIds, w.order);
  const shown = ids.filter((id) => !w.isHidden(id));
  const hiddenIds = ids.filter((id) => w.isHidden(id));
  const label = (id) => (id === 'schedule' ? t('wd.schedFull') : id === 'schedule:mine' ? t('home.schedule') : L((sections.find((x) => 'sec:' + x.id === id) || {}).title));

  useEffect(() => () => setEditing(false), [setEditing]);

  // довгий тап по віджету вмикає редагування
  const press = useRef(null);
  const pressPt = useRef({ x: 0, y: 0 });
  const down = (e) => {
    if (editing || e.target.closest('button, input')) return;
    const { clientX: x, clientY: y } = e;
    clearTimeout(press.current);
    press.current = setTimeout(() => setEditing(true), 550);
    pressPt.current = { x, y };
  };
  const cancel = () => clearTimeout(press.current);
  const moveCheck = (e) => {
    if (press.current && (Math.abs(e.clientX - pressPt.current.x) > 8 || Math.abs(e.clientY - pressPt.current.y) > 8)) cancel();
  };

  // Перетягування: плитка йде за пальцем, інші плавно розсуваються (FLIP)
  const gridRef = useRef(null);
  const drag = useRef(null);
  const prevPos = useRef({});
  const items = () => Array.from(gridRef.current ? gridRef.current.querySelectorAll('[data-wid]') : []);

  useLayoutEffect(() => {
    // після зміни порядку: усі, крім перетягуваної, їдуть зі старого місця на нове
    const next = {};
    items().forEach((el) => {
      const id = el.dataset.wid;
      next[id] = { x: el.offsetLeft, y: el.offsetTop };
      const old = prevPos.current[id];
      if (editing && old && (!drag.current || drag.current.id !== id) && (old.x !== next[id].x || old.y !== next[id].y) && el.animate) {
        el.animate([{ transform: `translate(${old.x - next[id].x}px, ${old.y - next[id].y}px)` }, { transform: 'translate(0, 0)' }], { duration: 240, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      }
    });
    prevPos.current = next;
    if (drag.current) place();
  });

  const gridPt = (e) => {
    const r = gridRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const place = () => {
    const d = drag.current;
    if (!d || !d.el) return;
    const x = d.pt.x - d.gx - d.el.offsetLeft;
    const y = d.pt.y - d.gy - d.el.offsetTop;
    d.el.style.transform = `translate(${x}px, ${y}px) scale(1.04)`;
  };
  const startDrag = (e) => {
    const el = e.target.closest && e.target.closest('[data-wid]');
    if (!editing || !el || e.target.closest('.wd-minus')) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    const pt = gridPt(e);
    drag.current = { id: el.dataset.wid, el, pt, gx: pt.x - el.offsetLeft, gy: pt.y - el.offsetTop, moved: false };
    setDragId(el.dataset.wid);
    place();
  };
  const onDrag = (e) => {
    const d = drag.current;
    if (!d) return;
    if (e.clientY < 110) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 170) window.scrollBy(0, 14);
    d.pt = gridPt(e);
    place();
    if (Date.now() - last.current < 120) return;
    const cx = d.pt.x - d.gx + d.el.offsetWidth / 2;
    const cy = d.pt.y - d.gy + d.el.offsetHeight / 2;
    const tgt = items().find((o) => o !== d.el && cx >= o.offsetLeft && cx <= o.offsetLeft + o.offsetWidth && cy >= o.offsetTop && cy <= o.offsetTop + o.offsetHeight);
    const others = items().filter((o) => o !== d.el);
    const bottom = Math.max(0, ...others.map((o) => o.offsetTop + o.offsetHeight));
    if (!tgt && !(others.length && cy > bottom)) return;
    const next = ids.filter((x) => x !== d.id);
    if (tgt) next.splice(ids.indexOf(tgt.dataset.wid), 0, d.id);
    else next.push(d.id);
    last.current = Date.now();
    w.setOrder(next);
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragId(null);
    const cur = d.el.style.transform;
    d.el.style.transform = '';
    if (d.el.animate && cur) d.el.animate([{ transform: cur }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    // Адмін: порядок розділів на головній стає порядком для всіх учнів
    if (isAdmin && d.moved) {
      const secIds = ids.filter((x) => x.startsWith('sec:')).map((x) => x.slice(4)).filter((x) => sections.some((q) => q.id === x));
      Promise.all(secIds.map((id, p) => supabase.from('content_sections').update({ position: p }).eq('id', id))).then(() => reload());
    }
  };

  const handle = (id) =>
    editing && (
      <button type="button" className="wd-minus glass" aria-label={t('wd.hide', { name: label(id) })} onClick={() => w.toggle(id)}>
        <Icon name="minus" size={20} />
      </button>
    );

  const tile = (x) => {
    const full = sectionOpen(x.id);
    const partN = !full && x.kind !== 'anatomy' ? openCount(x.id) : 0;
    const open = full || partN > 0;
    const until = !isAdmin && full && access[x.id] ? new Date(access[x.id]).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
    const to = x.kind === 'anatomy' ? '/anatomy' : `/section/${x.id}`;
    const sub = !x.published ? t('content.draft') : isFreeSection(x.id) ? t('content.free') : partN > 0 ? t('access.partial', { n: partN }) : open ? (until ? t('access.until', { date: until }) : L(x.hint)) : t('access.closed');
    return (
      <>
        <Link to={to} onClick={(e) => zoomTo(e, to)} className={'tile' + (open ? '' : ' locked-tile')} tabIndex={editing ? -1 : undefined}>
          <SectionTile section={x} size={32} />
          <span className="tile-text">
            <span className="tile-title">{L(x.title)}</span>
            <span className={'muted small' + (x.published ? '' : ' draft')}>{sub}</span>
          </span>
        </Link>
        {!editing && x.kind !== 'anatomy' && <EditFab to={`/admin/content/${x.id}`} />}
      </>
    );
  };

  return (
    <main className={'page wide nh' + (editing ? ' editing' : '')}>
      <h1 className="sr-only">{t('home.title')}</h1>
      {!online && (
        <div className="pill">
          <Icon name="wifiOff" size={16} /> {t('common.offline')}
        </div>
      )}
      <div ref={gridRef} className="tiles nh-grid" onPointerDown={(e) => (editing ? startDrag(e) : down(e))} onPointerMove={(e) => (editing ? onDrag(e) : moveCheck(e))} onPointerUp={() => (editing ? endDrag() : cancel())} onPointerCancel={() => (editing ? endDrag() : cancel())} onContextMenu={(e) => e.preventDefault()}>
        {shown.map((id) =>
          id === 'schedule' || id === 'schedule:mine' ? (
            <div key={id} data-wid={id} className={'nh-w span2' + (dragId === id ? ' drag' : '')}>
              <ScheduleWidget mineOnly={id === 'schedule:mine'} />
              {handle(id)}
            </div>
          ) : (
            (() => {
              const x = sections.find((s) => 'sec:' + s.id === id);
              return x ? (
                <div key={id} data-wid={id} className={'nh-w edit-wrap' + (dragId === id ? ' drag' : '')}>
                  {tile(x)}
                  {handle(id)}
                </div>
              ) : null;
            })()
          )
        )}
      </div>

      {editing && (
        <>
          <div className="wd-bar">
            <p className="wd-hint glass small">{t('wd.dragHint')}</p>
            <button type="button" className="wd-add glass" aria-label={t('wd.addOne')} onClick={() => setAdding(true)}>
              <Icon name="plus" size={24} />
            </button>
            <button type="button" className="wd-done" onClick={() => setEditing(false)}>
              {t('wd.done')}
            </button>
          </div>
          <div className={'sheet-root' + (adding ? ' open' : '')} aria-hidden={!adding}>
            <div className="sheet-backdrop" onClick={() => setAdding(false)} />
            <div className="sheet" role="dialog" aria-modal="true" aria-label={t('wd.addOne')}>
              <div className="sheet-head"><span className="sheet-grab" aria-hidden="true" /></div>
              <div className="sheet-body wd-sheet">
                <div className="wd-sheet-head">
                  <h2 className="h2">{t('wd.addOne')}</h2>
                  <button type="button" className="wd-x" aria-label={t('settings.close')} onClick={() => setAdding(false)}>
                    <Icon name="close" size={26} />
                  </button>
                </div>
                <p className="muted wd-sheet-hint">{hiddenIds.length ? t('wd.tapHint') : t('wd.none')}</p>
                {hiddenIds.map((id) => {
                  const x = sections.find((s) => 'sec:' + s.id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="wd-row"
                      onClick={() => {
                        w.toggle(id);
                        if (hiddenIds.length <= 1) setAdding(false);
                      }}
                    >
                      <span className="wd-row-icon" style={x ? { background: x.color, color: '#101214' } : undefined}>
                        <Icon name={x ? x.icon : 'calendar'} size={28} />
                      </span>
                      <span className="wd-row-text">
                        <b>{label(id)}</b>
                        <span className="muted">{x ? L(x.hint) : id === 'schedule:mine' ? t('wd.schedMineSub') : t('wd.scheduleSub')}</span>
                      </span>
                      <span className="wd-row-add" aria-hidden="true">
                        <Icon name="plus" size={22} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
