import { useI18n } from '../i18n/index.jsx';
import { useAdminPushPrefs } from '../lib/chat.js';

const KEYS = ['chat', 'payments'];

// Які пуш-сповіщення приходять тренеру. Вимкнене сповіщення не зникає: у чаті й оплатах лишаються лічильники.
export default function AdminPushPrefs() {
  const { t } = useI18n();
  const { prefs, set } = useAdminPushPrefs();
  return (
    <div className="stack">
      <span className="muted small">{t('ap.title')}</span>
      {KEYS.map((k) => {
        const on = prefs[k] !== false;
        return (
          <button key={k} type="button" className="set-row link-row push-row" role="switch" aria-checked={on} onClick={() => set(k, !on)}>
            <span className="set-label">{t('ap.' + k)}</span>
            <span className={'sw' + (on ? ' on' : '')} aria-hidden="true"><i /></span>
          </button>
        );
      })}
      <p className="muted small">{t('ap.hint')}</p>
    </div>
  );
}
