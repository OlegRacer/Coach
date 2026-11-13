import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';

// Прев'ю вправи: GIF, або коротке відео (mp4/webm) що крутиться по колу.
// `src` це шлях відносно public/ (наприклад "media/squat.mp4") або повне посилання https://...
// Відео mp4/webm у 10-20 разів легші за GIF і на iPhone працюють без звуку й автоматично.
const BASE = import.meta.env.BASE_URL;

function resolve(src) {
  return /^https?:\/\//.test(src) ? src : BASE + src.replace(/^\//, '');
}

// Відео-прев'ю завжди крутиться по колу: явно вмикаємо muted/loop (React не завжди ставить muted в DOM,
// а iPhone без цього не запускає автовідтворення), при завершенні запускаємо спочатку, а якщо автозапуск
// заблоковано (економія заряду) то запускаємо по дотику.
function LoopVideo({ url, title }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    v.muted = true;
    v.loop = true;
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const again = () => { v.currentTime = 0; play(); };
    const visible = () => { if (!document.hidden && v.paused) play(); };
    v.addEventListener('ended', again);
    v.addEventListener('loadeddata', play);
    document.addEventListener('visibilitychange', visible);
    play();
    return () => {
      v.removeEventListener('ended', again);
      v.removeEventListener('loadeddata', play);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [url]);
  return (
    <video
      ref={ref}
      src={url}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      aria-label={title}
      onClick={() => { const v = ref.current; if (v && v.paused) v.play().catch(() => {}); }}
    />
  );
}

export default function Media({ src, title }) {
  const { t } = useI18n();
  if (!src) {
    return <div className="media media-empty">{t('media.empty')}</div>;
  }
  const url = resolve(src);
  const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  return (
    <div className="media">
      {isVideo ? (
        <LoopVideo url={url} title={title} />
      ) : (
        <img src={url} alt={title} loading="lazy" />
      )}
    </div>
  );
}
