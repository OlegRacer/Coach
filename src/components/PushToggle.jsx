import { useEffect, useState } from 'react';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { currentSubscription, disablePush, enablePush, isIosBrowserTab, pushSupported, testPush } from '../lib/push.js';

// Перемикач пуш-сповіщень у профілі: дозвіл, підписка, тест.
export default function PushToggle() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    currentSubscription().then((s) => setOn(!!s && Notification.permission === 'granted'));
  }, [user]);
  if (!user) return null;
  if (!pushSupported() || isIosBrowserTab()) {
    return <p className="muted small">{isIosBrowserTab() ? t('push.ios') : t('push.unsupported')}</p>;
  }
  const toggle = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (on) {
        await disablePush();
        setOn(false);
      } else {
        const r = await enablePush(user.id, lang);
        setOn(r.ok);
        if (!r.ok) setMsg(r.reason === 'denied' ? t('push.denied') : t('push.error'));
      }
    } catch {
      setMsg(t('push.error'));
    }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true);
    const { error } = await testPush();
    setMsg(error ? t('push.error') : t('push.sent'));
    setBusy(false);
  };
  return (
    <div className="stack">
      <button type="button" className="set-row link-row" onClick={toggle} disabled={busy} aria-pressed={on}>
        <span className="set-label">{t('push.title')}</span>
        <span className={'badge-status ' + (on ? 'approved' : 'pending')}>{on ? t('push.on') : t('push.off')}</span>
      </button>
      {on && <button type="button" className="btn-ghost" onClick={test} disabled={busy}>{t('push.test')}</button>}
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  );
}
