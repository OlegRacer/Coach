import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
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
  // на кореневих вкладках кнопка «назад» не потрібна (правило навігації iOS)
  const root = pathname === '/schedule' || pathname === '/plans';
  useEffect(() => {
    const el = document.documentElement;
    if (root) el.dataset.tabRoot = '1';
    else delete el.dataset.tabRoot;
    return () => delete el.dataset.tabRoot;
  }, [root]);
  // у редакторах адмінки панель не потрібна: більше місця для форм
  if (pathname.startsWith('/admin')) return null;
  return (
    <nav className="tabbar glass" aria-label={t('nav.tabs')}>
      {TABS.map((x) => {
        const active = x.end ? pathname === '/' || (x.also || []).some((p) => pathname.startsWith(p)) : pathname.startsWith(x.to);
        return (
          <NavLink key={x.to} to={x.to} className={'tab' + (active ? ' active' : '')} aria-current={active ? 'page' : undefined}>
            <Icon name={x.icon} size={26} />
            <span>{t(x.key)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
