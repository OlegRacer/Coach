import { useEffect, useState } from 'react';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { currentSubscription, disablePush, enablePush, isIosBrowserTab, pushSupported, swReady, testPush } from '../lib/push.js';

// Перемикач пуш-сповіщень у профілі: дозвіл, підписка, тест.
export default function PushToggle() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [on, setOnRaw] = useState(() => {
    try {
      return localStorage.getItem('push:on') === '1';
    } catch {
      return false;
    }
  });
  const setOn = (v) => {
    setOnRaw(v);
    try {
      localStorage.setItem('push:on', v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const sync = () => currentSubscription().then((s) => setOn(!!s && Notification.permission === 'granted'));
    sync();
    // повернулися в додаток (після системного діалогу чи налаштувань) — оновлюємо стан
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [user]);
  // Кнопка активна, коли сервіс-воркер готовий: одразу після додавання на екран «Додому» це займає кілька секунд
  useEffect(() => {
    let alive = true;
    const slowT = setTimeout(() => alive && setSlow(true), 6000);
    swReady().then((ok) => {
      if (!alive) return;
      setReady(ok);
      setSlow(!ok);
    });
    return () => {
      alive = false;
      clearTimeout(slowT);
    };
  }, []);
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
        if (!r.ok) setMsg(r.reason === 'denied' ? t('push.denied') : r.reason === 'sub' ? t('push.retry') + (r.detail ? ` (${r.detail})` : '') : t('push.error') + (r.detail ? ` (${r.detail})` : ''));
      }
    } catch (e) {
      setMsg(t('push.error') + (e && e.name ? ` (${e.name})` : ''));
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
      <button type="button" className="set-row link-row" onClick={toggle} disabled={busy || !ready} aria-pressed={on}>
        <span className="set-label">{t('push.title')}</span>
        <span className={'badge-status ' + (on ? 'approved' : 'pending')}>{!ready ? t('push.preparing') : on ? t('push.on') : t('push.off')}</span>
      </button>
      {on && <button type="button" className="btn-ghost" onClick={test} disabled={busy}>{t('push.test')}</button>}
      {!ready && slow && <p className="muted small">{t('push.slow')}</p>}
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  );
}
