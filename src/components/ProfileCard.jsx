import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Onboarding from './Onboarding.jsx';
import ProfileDetails from './ProfileDetails.jsx';
import SignInNotice from './SignInNotice.jsx';
import Icon from './Icon.jsx';
import useOnline from '../lib/useOnline.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Картка профілю: гість із кнопкою входу або увійшов користувач (фото, ім'я, вийти).
// Тренеру (адміну) додатково показується перехід до списку учнів.
export default function ProfileCard() {
  const { t } = useI18n();
  const [pendingPay, setPendingPay] = useState(0);
  const { user, isAdmin, details, signInGoogle, signInLine, signOut, error } = useAuth();
  const [mode, setMode] = useState(null); // null | 'view' | 'edit'
  const [notice, setNotice] = useState(false);
  const filled = !!(details && details.completed_at);
  const online = useOnline();
  useEffect(() => {
    if (!isAdmin || !online) return;
    supabase
      .from('payment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingPay(count || 0));
  }, [isAdmin, online]);
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
        <div className="stack">
          <button type="button" className="btn-light" onClick={() => setNotice(true)} disabled={!online}>
            {online ? t('auth.signInGoogle') : t('auth.needOnline')}
          </button>
          <button type="button" className="btn-line" onClick={signInLine} disabled={!online}>
            {t('auth.signInLine')}
          </button>
        </div>
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
          <br />
          <span className="muted">{error}</span>
        </p>
      )}

      {user && !isAdmin && (
        <Link to="/plans" className="set-row link-row">
          <span className="set-label">{t('pay.title')}</span>
          <span className="muted">
            <Icon name="chevron" size={20} />
          </span>
        </Link>
      )}

      {isAdmin && (
        <>
          <Link to="/admin/students" className="set-row link-row">
            <span className="set-label">{t('students.title')}</span>
            <span className="muted">
              <Icon name="chevron" size={20} />
            </span>
          </Link>
          <Link to="/admin/payments" className="set-row link-row">
            <span className="set-label">
              {t('pay.admin')}
              {pendingPay > 0 && <span className="badge-count">{pendingPay}</span>}
            </span>
            <span className="muted">
              <Icon name="chevron" size={20} />
            </span>
          </Link>
          <Link to="/admin/content" className="set-row link-row">
            <span className="set-label">{t('content.link')}</span>
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
