import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useUi, SWITCH_FOR_ALL } from '../lib/ui.jsx';

// Перемикач «Класичний / Новий інтерфейс».
export default function UiSwitch() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const { ui, setUi } = useUi();
  if (!SWITCH_FOR_ALL && !isAdmin) return null;
  return (
    <div className="stack">
      <span className="muted small">{t('ui.title')}</span>
      <div className="chips" role="group" aria-label={t('ui.title')}>
        {['classic', 'next'].map((v) => (
          <button type="button" key={v} className={'chip' + (ui === v ? ' active' : '')} aria-pressed={ui === v} onClick={() => setUi(v)}>
            {t(`ui.${v}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
