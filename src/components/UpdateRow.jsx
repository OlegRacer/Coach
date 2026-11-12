import { useUpdate } from '../lib/update.jsx';
import useOnline from '../lib/useOnline.js';
import { useI18n } from '../i18n/index.jsx';

const BUILD = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

// Рядок у налаштуваннях: версія + ручна перевірка оновлень.
export default function UpdateRow() {
  const { t } = useI18n();
  const { needRefresh, apply, check, checking, upToDate } = useUpdate();
  const online = useOnline();
  const version = BUILD ? BUILD.slice(0, 16).replace('T', ' ') : '';

  let status = version ? t('update.version', { v: version }) : '';
  if (!online) status = t('update.offline');
  else if (checking) status = t('update.checking');
  else if (upToDate && !needRefresh) status = t('update.latest');

  return (
    <div className="set-row">
      <div className="profile-text">
        <span className="set-label">{t('update.check')}</span>
        <span className="muted small">{needRefresh ? t('update.available') : status}</span>
      </div>
      <button
        type="button"
        className="share-btn"
        style={{ minWidth: 110 }}
        onClick={needRefresh ? apply : check}
        disabled={!needRefresh && (checking || !online)}
      >
        {needRefresh ? t('update.apply') : t('update.check').split(' ')[0]}
      </button>
    </div>
  );
}
