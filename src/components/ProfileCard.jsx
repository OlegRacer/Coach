import { useState } from 'react';
import { Link } from 'react-router-dom';
import Onboarding from './Onboarding.jsx';
import ProfileDetails from './ProfileDetails.jsx';
import SignInNotice from './SignInNotice.jsx';
import Icon from './Icon.jsx';
import useOnline from '../lib/useOnline.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Картка профілю: гість із кнопкою входу або увійшов користувач (фото, ім'я, вийти).
// Тренеру (адміну) додатково показується перехід до списку учнів.
export default function ProfileCard() {
  const { t } = useI18n();
  const { user, isAdmin, details, signInGoogle, signOut, error } = useAuth();
  const [mode, setMode] = useState(null); // null | 'view' | 'edit'
  const [notice, setNotice] = useState(false);
  const filled = !!(details && details.completed_at);
  const online = useOnline();
  const canOpen = !!user && !isAdmin && online;

  const Tag = canOpen ? 'button' : 'div';
  const tagProps = canOpen ? { type: 'button', onClick: () => setMode(filled ? 'view' : 'edit') } : {};

  return (
    <div className="profile-wrap">
      <Tag className={'profile' + (canOpen ? ' tappable' : '')} {...tagProps}>
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
        </div>
        {canOpen && (
          <span className="muted" aria-hidden="true">
            <Icon name="chevron" size={20} />
          </span>
        )}
      </Tag>
      {mode === 'view' && <ProfileDetails onClose={() => setMode(null)} onEdit={() => setMode('edit')} />}
      {mode === 'edit' && <Onboarding onClose={() => setMode(null)} />}

      {user ? (
        <button type="button" className="btn-ghost" onClick={signOut}>
          {t('auth.signOut')}
        </button>
      ) : (
        <button type="button" className="btn-light" onClick={() => setNotice(true)} disabled={!online}>
          {online ? t('auth.signInGoogle') : t('auth.needOnline')}
        </button>
      )}
      {notice && (
        <SignInNotice
          onCancel={() => setNotice(false)}
          onContinue={() => {
            setNotice(false);
            signInGoogle();
          }}
        />
      )}
      {error && (
        <p className="small err" role="alert">
          {t('auth.error')}
        </p>
      )}

      {isAdmin && (
        <>
          <Link to="/admin/students" className="set-row link-row">
            <span className="set-label">{t('students.title')}</span>
            <span className="muted">
              <Icon name="chevron" size={20} />
            </span>
          </Link>
          <Link to="/admin/schedule" className="set-row link-row">
            <span className="set-label">{t('sa.link')}</span>
            <span className="muted">
              <Icon name="chevron" size={20} />
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
