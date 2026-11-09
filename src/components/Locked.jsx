import TopBar from './TopBar.jsx';
import Icon from './Icon.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Екран «розділ закритий». section: fitness | mfr | mobility | anatomy
export default function Locked({ section, title }) {
  const { t, locale } = useI18n();
  const { user, access } = useAuth();
  const exp = access && access[section];
  const date = exp ? new Date(exp).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return (
    <main className="page">
      <TopBar title={title} />
      <div className="card locked">
        <span className="ob-icon">
          <Icon name="lock" size={30} />
        </span>
        <h2 className="h2">{t('access.lockedTitle')}</h2>
        <p className="body">{user ? t('access.lockedText') : t('access.signin')}</p>
        {user && date && <p className="muted small">{t('access.expired', { date })}</p>}
      </div>
    </main>
  );
}
