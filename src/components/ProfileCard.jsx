import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import useOnline from '../lib/useOnline.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Картка профілю: гість із кнопкою входу або увійшов користувач (фото, ім'я, вийти).
// Тренеру (адміну) додатково показується перехід до списку учнів.
export default function ProfileCard() {
  const { t } = useI18n();
  const { user, isAdmin, signInGoogle, signOut, error } = useAuth();
  const online = useOnline();

  return (
    <div className="profile-wrap">
      <div className="profile">
        <span className="avatar" aria-hidden="true">
          {user && user.avatar ? (
            <img src={user.avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            <Icon name="user" size={28} />
          )}
        </span>
        <div className="profile-text">
          <span id="settings-title" className="muted small">
            {user ? (isAdmin ? t('profile.coach') : t('profile.title')) : t('profile.title')}
          </span>
          <span className="profile-name">{user ? user.name : t('profile.guest')}</span>
          {user && user.email && <span className="muted small profile-email">{user.email}</span>}
        </div>
      </div>

      {user ? (
        <button type="button" className="btn-ghost" onClick={signOut}>
          {t('auth.signOut')}
        </button>
      ) : (
        <button type="button" className="btn-light" onClick={signInGoogle} disabled={!online}>
          {online ? t('auth.signInGoogle') : t('auth.needOnline')}
        </button>
      )}
      {error && (
        <p className="small err" role="alert">
          {t('auth.error')}
        </p>
      )}

      {isAdmin && (
        <Link to="/admin/students" className="set-row link-row">
          <span className="set-label">{t('students.title')}</span>
          <span className="muted">
            <Icon name="chevron" size={20} />
          </span>
        </Link>
      )}
    </div>
  );
}
