import { useUpdate } from '../lib/update.jsx';
import { useI18n } from '../i18n/index.jsx';

// Плашка знизу: з'являється, коли нова версія вже завантажена.
export default function UpdateBanner() {
  const { t } = useI18n();
  const { needRefresh, apply } = useUpdate();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>{t('update.available')}</span>
      <button type="button" className="update-btn" onClick={apply}>
        {t('update.apply')}
      </button>
    </div>
  );
}
