import { useEffect, useRef, useState } from 'react';
import { useEditing } from '../lib/widgets.js';
import WidgetSheet from './WidgetSheet.jsx';
import AddWorkout from '../components/AddWorkout.jsx';
import { useAuth } from '../auth/index.jsx';
import { flushSync } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useUi } from '../lib/ui.jsx';
import { useI18n } from '../i18n/index.jsx';

// Нижня панель вкладок у стилі iOS 26/27: плаваюча «скляна» капсула.
const TABS = [
  { to: '/', icon: 'barbell', key: 'nav.workouts', end: true, also: ['/section', '/exercise', '/program', '/anatomy', '/equipment'] },
  { to: '/schedule', icon: 'calendar', key: 'nav.schedule' },
  { to: '/plans', icon: 'ticket', key: 'nav.plans' },
  { to: '/profile', icon: 'user', key: 'nav.profile' }
];

export default function TabBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { ui } = useUi();
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [editing] = useEditing();
  // на кореневих вкладках кнопка «назад» не потрібна (правило навігації iOS)
  const root = pathname === '/schedule' || pathname === '/plans';
  // сторінки вкладок (розклад, пакети, профіль, головна) без анімації появи: нічого не блимає
  const tabPage = ['/', '/schedule', '/plans', '/profile'].includes(pathname);
  useEffect(() => {
    const el = document.documentElement;
    if (tabPage) el.dataset.tabPage = '1';
    else delete el.dataset.tabPage;
    return () => delete el.dataset.tabPage;
  }, [tabPage]);
  useEffect(() => {
    const el = document.documentElement;
    if (root) el.dataset.tabRoot = '1';
    else delete el.dataset.tabRoot;
    return () => delete el.dataset.tabRoot;
  }, [root]);
  const isActive = (x) => (x.end ? pathname === '/' || (x.also || []).some((p) => pathname.startsWith(p)) : pathname.startsWith(x.to));
  const cur = TABS.findIndex(isActive);
  // Liquid Glass: сторінки міняються «каруселлю» (як екрани робочого столу) через View Transitions
  const goTo = (i) => {
    const vt = document.startViewTransition;
    if (!vt || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate(TABS[i].to);
      return;
    }
    const el = document.documentElement;
    el.dataset.vt = i > cur ? 'fwd' : 'back';
    const tr = document.startViewTransition(() => {
      flushSync(() => navigate(TABS[i].to));
    });
    const done = () => delete el.dataset.vt;
    tr.finished.then(done, done);
  };
  const go = (e, i) => {
    if (suppress.current) {
      e.preventDefault();
      suppress.current = false;
      return;
    }
    if (ui !== 'next' || i === cur || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    goTo(i);
  };
  // Перетягування бульбашки: беремо її пальцем (на активній вкладці), тягнемо, відпускаємо на потрібній вкладці
  const nav = useRef(null);
  const suppress = useRef(false);
  const dr = useRef(null);
  const step = () => {
    const w = nav.current.getBoundingClientRect().width;
    return (w - 24) / 4 + 4;
  };
  const onDown = (e) => {
    if (ui !== 'next' || cur < 0 || e.button > 0) return;
    const tab = e.target.closest && e.target.closest('.tab');
    if (!tab || !tab.classList.contains('active')) return;
    dr.current = { x: e.clientX, id: e.pointerId, moved: false };
  };
  const onMove = (e) => {
    const d = dr.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.abs(e.clientX - d.x) < 6) return;
      d.moved = true;
      nav.current.setPointerCapture(d.id);
      nav.current.dataset.drag = '1';
    }
    const st = step();
    const pos = Math.min(3 * st, Math.max(0, cur * st + e.clientX - d.x));
    nav.current.style.setProperty('--drag', pos + 'px');
    d.idx = Math.round(pos / st);
  };
  const onUp = () => {
    const d = dr.current;
    dr.current = null;
    if (!d || !d.moved) return;
    suppress.current = true;
    setTimeout(() => (suppress.current = false), 50);
    const el = nav.current;
    delete el.dataset.drag;
    el.style.removeProperty('--drag');
    if (d.idx !== undefined && d.idx !== cur) goTo(d.idx);
  };
  // у редакторах адмінки панель не потрібна: більше місця для форм (return після всіх хуків)
  if (pathname.startsWith('/admin') || editing) return null;
  const showAdd = !!user && (pathname === '/' || pathname === '/schedule');
  return (
    <>
    <nav ref={nav} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className={'tabbar' + (ui === 'next' ? ' glass' : '')} aria-label={t('nav.tabs')} style={{ '--i': Math.max(cur, 0) }} data-none={cur < 0 ? '1' : undefined}>
      {ui === 'next' && <span className="tab-bubble" aria-hidden="true" />}
      {TABS.map((x, i) => {
        const active = i === cur;
        return (
          <NavLink key={x.to} to={x.to} draggable={false} onClick={(e) => go(e, i)} className={'tab' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
            <span className="tab-ic">
              <Icon name={x.icon} size={26} />
            </span>
            <span className="tab-label">{t(x.key)}</span>
          </NavLink>
        );
      })}
    </nav>
    {showAdd && (
      <button type="button" className="tab-add glass" aria-label={t('aw.add')} aria-haspopup="dialog" onClick={() => setSheet(true)}>
        <Icon name="plus" size={24} />
      </button>
    )}
    <WidgetSheet open={sheet} onClose={() => setSheet(false)} onAddWorkout={() => setAdding(true)} canEdit={pathname === '/'} />
    {adding && <AddWorkout onClose={() => setAdding(false)} onSaved={() => window.dispatchEvent(new Event('schedule:changed'))} />}
    </>
  );
}
