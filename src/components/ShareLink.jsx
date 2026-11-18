import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import Icon from './Icon.jsx';

// «Поділитися»: одна кнопка. Відкриває системне меню (iPhone/Android), а де його немає — копіює посилання.
export default function ShareLink({ url }) {
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  const link = url || window.location.origin + window.location.pathname;

  async function onShare() {
    setStatus('');
    if (navigator.share) {
      try {
        await navigator.share({ title: t('home.title'), text: t('share.text'), url: link });
      } catch {
        /* користувач закрив вікно */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setStatus(t('share.copied'));
    } catch {
      setStatus(link);
    }
  }

  return (
    <>
      <button type="button" className="set-row link-row" onClick={onShare}>
        <span className="set-label">{t('share.title')}</span>
        <span className="muted">
          <Icon name="chevron" size={20} />
        </span>
      </button>
      {status && (
        <p className="muted small share-status" role="status">
          {status}
        </p>
      )}
    </>
  );
}
