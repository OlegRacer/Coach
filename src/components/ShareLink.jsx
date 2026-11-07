import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

// Кнопки надсилання посилання у месенджери. Працюють без ключів і акаунтів: це звичайні посилання-"діліться".
// Instagram не дає заповнити повідомлення з посилання, тому копіюємо посилання й відкриваємо його чати.
// `url` за замовчуванням адреса додатка; для запрошення конкретного учня сюди передаватимемо його персональне посилання.
export default function ShareLink({ url }) {
  const { t } = useI18n();
  const [status, setStatus] = useState('');
  const link = url || window.location.origin + window.location.pathname;
  const text = t('share.text');
  const both = encodeURIComponent(`${text} ${link}`);

  const targets = [
    { name: 'LINE', href: `https://line.me/R/share?text=${both}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}` },
    { name: 'WhatsApp', href: `https://wa.me/?text=${both}` }
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch {
      return false;
    }
  }

  async function onCopy() {
    setStatus((await copy()) ? t('share.copied') : link);
  }
  async function onInstagram() {
    setStatus((await copy()) ? t('share.instagram') : link);
    window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener');
  }
  async function onNative() {
    try {
      await navigator.share({ title: t('home.title'), text, url: link });
    } catch {
      /* користувач закрив вікно */
    }
  }

  return (
    <div className="set-block">
      <span className="set-label">{t('share.title')}</span>
      <div className="share-grid">
        {targets.map((x) => (
          <a key={x.name} className="share-btn" href={x.href} target="_blank" rel="noopener noreferrer">
            {x.name}
          </a>
        ))}
        <button type="button" className="share-btn" onClick={onInstagram}>
          Instagram
        </button>
        <button type="button" className="share-btn" onClick={onCopy}>
          {t('share.copy')}
        </button>
        {navigator.share && (
          <button type="button" className="share-btn" onClick={onNative}>
            {t('share.more')}
          </button>
        )}
      </div>
      <p className="muted small share-status" role="status">
        {status}
      </p>
    </div>
  );
}
