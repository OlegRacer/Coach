import { useEffect, useState } from 'react';
import { useEditing } from '../lib/widgets.js';
import WidgetSheet from './WidgetSheet.jsx';
import AddWorkout from '../components/AddWorkout.jsx';
import { useAuth } from '../auth/index.jsx';
import { NavLink, useLocation } from 'react-router-dom';
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
  const { user } = useAuth();
  const { ui } = useUi();
  const [adding, setAdding] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [editing] = useEditing();
  // на кореневих вкладках кнопка «назад» не потрібна (правило навігації iOS)
  const root = pathname === '/schedule' || pathname === '/plans';
  useEffect(() => {
    const el = document.documentElement;
    if (root) el.dataset.tabRoot = '1';
    else delete el.dataset.tabRoot;
    return () => delete el.dataset.tabRoot;
  }, [root]);
  // у редакторах адмінки панель не потрібна: більше місця для форм
  if (pathname.startsWith('/admin') || editing) return null;
  const showAdd = !!user && (pathname === '/' || pathname === '/schedule');
  return (
    <>
    <nav className={'tabbar' + (ui === 'next' ? ' glass' : '') + ''} aria-label={t('nav.tabs')}>
      {TABS.map((x) => {
        const active = x.end ? pathname === '/' || (x.also || []).some((p) => pathname.startsWith(p)) : pathname.startsWith(x.to);
        return (
          <NavLink key={x.to} to={x.to} className={'tab' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
            <span className="tab-ic">
              <Icon name={x.icon} size={26} />
            </span>
            <span className="tab-label">{t(x.key)}</span>
          </NavLink>
        );
      })}
    </nav>
    {showAdd && (
      <button type="button" className="tab-add glass" aria-label={t('aw.add')} aria-haspopup={ui === 'next' ? 'dialog' : undefined} onClick={() => (ui === 'next' ? setSheet(true) : setAdding(true))}>
        <Icon name="plus" size={24} />
      </button>
    )}
    <WidgetSheet open={sheet} onClose={() => setSheet(false)} onAddWorkout={() => setAdding(true)} canEdit={ui === 'next' && pathname === '/'} />
    {adding && <AddWorkout onClose={() => setAdding(false)} onSaved={() => window.dispatchEvent(new Event('schedule:changed'))} />}
    </>
  );
}
