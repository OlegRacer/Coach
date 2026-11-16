import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import EditFab from '../components/EditFab.jsx';
import ScheduleWidget from '../components/ScheduleWidget.jsx';
import useOnline from '../lib/useOnline.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { orderIds, useEditing, useWidgets } from '../lib/widgets.js';

// Головна нового інтерфейсу: віджети (розклад і розділи). Довгий тап або «+» → «Редагувати віджети»:
// пунктирні рамки, «−» ховає віджет, смужка праворуч перетягує, «Готово» завершує, «+» над ним повертає сховані.
export default function NextHome() {
  const { t, locale } = useI18n();
  const online = useOnline();
  const { isAdmin, access } = useAuth();
  const { sections, sectionOpen, openCount, isFreeSection } = useContent();
  const L = useL();
  const w = useWidgets();
  const [editing, setEditing] = useEditing();
  const [adding, setAdding] = useState(false);
  const [dragId, setDragId] = useState(null);
  const last = useRef(0);

  const allIds = ['schedule', ...sections.map((x) => 'sec:' + x.id)];
  const ids = orderIds(allIds, w.order);
  const shown = ids.filter((id) => !w.isHidden(id));
  const hiddenIds = ids.filter((id) => w.isHidden(id));
  const label = (id) => (id === 'schedule' ? t('home.schedule') : L((sections.find((x) => 'sec:' + x.id === id) || {}).title));

  useEffect(() => () => setEditing(false), [setEditing]);

  // довгий тап по віджету вмикає редагування
  const press = useRef(null);
  const down = (e) => {
    if (editing || e.target.closest('button, input')) return;
    const { clientX: x, clientY: y } = e;
    clearTimeout(press.current);
    press.current = setTimeout(() => setEditing(true), 550);
    press.current.x = x;
    press.current.y = y;
  };
  const cancel = () => clearTimeout(press.current);
  const moveCheck = (e) => {
    if (press.current && (Math.abs(e.clientX - press.current.x) > 8 || Math.abs(e.clientY - press.current.y) > 8)) cancel();
  };

  const startDrag = (id) => (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragId(id);
  };
  const onDrag = (e) => {
    if (!dragId) return;
    if (e.clientY < 110) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 170) window.scrollBy(0, 14);
    if (Date.now() - last.current < 180) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const tgt = el && el.closest('[data-wid]');
    if (!tgt || tgt.dataset.wid === dragId) return;
    const next = ids.filter((x) => x !== dragId);
    next.splice(next.indexOf(tgt.dataset.wid) + (ids.indexOf(tgt.dataset.wid) > ids.indexOf(dragId) ? 1 : 0), 0, dragId);
    last.current = Date.now();
    w.setOrder(next);
  };
  const endDrag = () => setDragId(null);

  const handle = (id) =>
    editing && (
      <>
        <button type="button" className="wd-minus glass" aria-label={t('wd.hide', { name: label(id) })} onClick={() => w.toggle(id)}>
          <Icon name="minus" size={20} />
        </button>
        <span
          role="button"
          tabIndex={0}
          className="wd-grip glass"
          aria-label={t('wd.drag', { name: label(id) })}
          onPointerDown={startDrag(id)}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <Icon name="grip" size={20} />
        </span>
      </>
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
        <Link to={to} className={'tile' + (open ? '' : ' locked-tile')} tabIndex={editing ? -1 : undefined}>
          <span className="tile-icon" style={{ background: x.color }}>
            <Icon name={x.icon} size={32} />
          </span>
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
      <div className="tiles nh-grid" onPointerDown={down} onPointerUp={cancel} onPointerCancel={cancel} onPointerMove={moveCheck} onContextMenu={(e) => e.preventDefault()}>
        {shown.map((id) =>
          id === 'schedule' ? (
            <div key={id} data-wid={id} className={'nh-w span2' + (dragId === id ? ' drag' : '')}>
              <ScheduleWidget />
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
              <div className="sheet-body">
                <h2 className="h2">{t('wd.addOne')}</h2>
                {!hiddenIds.length && <p className="muted small">{t('wd.none')}</p>}
                {hiddenIds.map((id) => (
                  <div key={id} className="set-row">
                    <span className="set-label">{label(id)}</span>
                    <button type="button" className="btn-ghost btn-small" onClick={() => { w.toggle(id); if (hiddenIds.length <= 1) setAdding(false); }}>
                      <Icon name="plus" size={16} /> {t('wd.add')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
