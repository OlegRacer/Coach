import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Onboarding from './Onboarding.jsx';
import ProfileDetails from './ProfileDetails.jsx';
import PushToggle from './PushToggle.jsx';
import LinkedLogins from './LinkedLogins.jsx';
import UiSwitch from './UiSwitch.jsx';
import ThemeSwitch from './ThemeSwitch.jsx';
import SignInNotice from './SignInNotice.jsx';
import Icon from './Icon.jsx';
import useOnline from '../lib/useOnline.js';
import { supabase } from '../lib/supabase.js';
import { resetCache } from '../lib/resetCache.js';
import { useAuth } from '../auth/index.jsx';
import { useChatUnread } from '../lib/chat.js';
import AdminPushPrefs from './AdminPushPrefs.jsx';
import { useI18n } from '../i18n/index.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import ShareLink from './ShareLink.jsx';
import UpdateRow from './UpdateRow.jsx';
import { startTour } from '../tour/Tour.jsx';
import useSortable from '../lib/useSortable.js';

const ORDER_KEY = 'profile-order';
function readOrder() {
  try {
    const v = JSON.parse(localStorage.getItem(ORDER_KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
// збережений порядок + нові блоки (яких ще немає в ньому) в кінець
function mergeOrder(saved, defaults) {
  const keep = saved.filter((id) => defaults.includes(id));
  return [...keep, ...defaults.filter((id) => !keep.includes(id))];
}
function saveOrder(ids) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  supabase.auth.updateUser({ data: { profile_order: ids } }).catch(() => {});
}

// Картка профілю: гість із кнопкою входу або увійшов користувач (фото, ім'я, вийти).
// Тренеру (адміну) додатково показується перехід до списку учнів.
export default function ProfileCard({ tail = false }) {
  const { t } = useI18n();
  const [pendingPay, setPendingPayRaw] = useState(() => {
    try {
      return Number(localStorage.getItem('pay:pending')) || 0;
    } catch {
      return 0;
    }
  });
  const setPendingPay = (n) => {
    setPendingPayRaw(n);
    try {
      localStorage.setItem('pay:pending', String(n));
    } catch {
      /* ignore */
    }
  };
  const chatUnread = useChatUnread();
  const { user, isAdmin, details, signInGoogle, signInLine, signOut, error } = useAuth();
  const [mode, setMode] = useState(null); // null | 'view' | 'edit'
  const [notice, setNotice] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [saved, setSaved] = useState(readOrder);
  // порядок з акаунта (щоб був однаковий на всіх пристроях тренера)
  useEffect(() => {
    if (!user) return;
    supabase.auth.getSession().then(({ data }) => {
      const m = data && data.session && data.session.user && data.session.user.user_metadata;
      if (m && Array.isArray(m.profile_order)) setSaved(m.profile_order);
    });
  }, [user]);
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
  const [newFb, setNewFb] = useState(0);
  useEffect(() => {
    if (!isAdmin || !online) return;
    supabase
      .from('feedback')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
      .then(({ count }) => setNewFb(count || 0));
  }, [isAdmin, online]);
  const canOpen = !!user && !isAdmin && online;

  const Tag = canOpen ? 'button' : 'div';
  const tagProps = canOpen ? { type: 'button', onClick: () => setMode(filled ? 'view' : 'edit') } : {};


  // Блоки налаштувань: порядок можна міняти перетягуванням , зберігається в акаунті й на пристрої.
  const links = (to, label, badge) => (
    <Link to={to} className="set-row link-row">
      <span className="set-label">{label}{badge}</span>
      <span className="muted"><Icon name="chevron" size={20} /></span>
    </Link>
  );
  const cnt = (n) => (n > 0 ? <span className="badge-count">{n}</span> : null);
  const blocks = {
    pay: user && !isAdmin ? links('/plans', t('pay.title')) : null,
    equip: links('/equipment', t('equip.mine')),
    ui: <UiSwitch />,
    theme: <ThemeSwitch />,
    logins: <LinkedLogins />,
    push: <PushToggle />,
    pushprefs: isAdmin ? <AdminPushPrefs /> : null,
    reset: (
      <div className="set-block">
        <button type="button" className="btn-ghost" disabled={clearing} onClick={() => { setClearing(true); resetCache(); }}>
          {clearing ? t('profile.resetting') : t('profile.resetCache')}
        </button>
        <span className="muted small">{t('profile.resetCacheHint')}</span>
      </div>
    ),
    chat: user && !isAdmin ? links('/chat', t('chat.title'), cnt(chatUnread)) : null,
    feedback: user && !isAdmin ? links('/feedback', t('fb.title')) : null,
    students: isAdmin ? links('/admin/students', t('students.title')) : null,
    achat: isAdmin ? links('/admin/chat', t('chat.inbox'), cnt(chatUnread)) : null,
    apay: isAdmin ? links('/admin/payments', t('pay.admin'), cnt(pendingPay)) : null,
    apush: isAdmin ? links('/admin/push', t('bc.title')) : null,
    achal: isAdmin ? links('/admin/challenges', t('chal.admin')) : null,
    acontent: isAdmin ? links('/admin/content', t('content.link')) : null,
    aequip: isAdmin ? links('/admin/equipment', t('equip.admin')) : null,
    astorage: isAdmin ? links('/admin/storage', t('mem.title')) : null,
    afeedback: isAdmin ? links('/admin/feedback', t('fb.admin'), cnt(newFb)) : null,
    howto: tail ? (
      <button type="button" className="set-row link-row" onClick={startTour}>
        <span className="set-label">{t('tour.howto')}</span>
        <span className="muted"><Icon name="chevron" size={20} /></span>
      </button>
    ) : null,
    lang: tail ? (
      <div className="set-row">
        <span className="set-label">{t('settings.language')}</span>
        <LangSwitcher />
      </div>
    ) : null,
    share: tail ? <ShareLink /> : null,
    update: tail ? <UpdateRow /> : null,
    aschedule: isAdmin ? links('/admin/schedule', t('sa.link')) : null
  };
  const defaults = Object.keys(blocks).filter((k) => blocks[k]);
  const { order, rowProps } = useSortable(
    mergeOrder(saved, defaults),
    (ids) => { setSaved(ids); saveOrder(ids); },
    true
  );

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

      {order.map((id) => (blocks[id] ? <div key={id} {...rowProps(id)} data-tour={'p-' + id}>{blocks[id]}</div> : null))}
      <span className="muted small">{t('profile.reorderHint')}</span>
    </div>
  );
}
