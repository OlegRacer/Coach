import { useState } from 'react';
import useOnline from '../lib/useOnline.js';
import { useI18n } from '../i18n/index.jsx';

// Не вантажимо плеєр, поки учень не натисне кнопку: швидше відкривається сторінка
// і не витрачається трафік. Потрібен інтернет.
// `id` це код відео з посилання YouTube (частина після v= або після youtu.be/).
export default function YouTubePlayer({ id, title }) {
  const { t } = useI18n();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const label = title || t('exercise.watch');

  if (!id) return null;

  if (open && online) {
    return (
      <div className="video">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`}
          title={label}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="yt-thumb"
      onClick={() => online && setOpen(true)}
      disabled={!online}
      style={{ backgroundImage: online ? `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)` : 'none' }}
    >
      <span className="yt-play" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
      <span className="yt-label">{online ? label : t('video.onlineOnly')}</span>
    </button>
  );
}
