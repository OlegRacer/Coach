import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';

// Прев'ю вправи: GIF, або коротке відео (mp4/webm) що крутиться по колу.
// `src` це шлях відносно public/ (наприклад "media/squat.mp4") або повне посилання https://...
// Відео mp4/webm у 10-20 разів легші за GIF і на iPhone працюють без звуку й автоматично.
const BASE = import.meta.env.BASE_URL;

function resolve(src) {
  return /^https?:\/\//.test(src) ? src : BASE + src.replace(/^\//, '');
}

// Відео-прев'ю: звичайне нативне зациклення без додаткових завантажень у пам'ять (на iPhone вони вішали вкладку).
// muted/loop виставляємо явно, бо React не завжди кладе muted в DOM, а iPhone без нього не запускає автоплей.
function LoopVideo({ url, title }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    v.muted = true;
    v.volume = 0;
    v.loop = true;
    // Відео з Flow/Veo має звукову доріжку; на iPhone вона підвішує стик витків циклу, тому вимикаємо її зовсім.
    const killAudio = () => {
      try {
        const tr = v.audioTracks;
        if (tr) for (let i = 0; i < tr.length; i += 1) tr[i].enabled = false;
      } catch (e) { /* не всі браузери підтримують */ }
    };
    killAudio();
    v.addEventListener('loadedmetadata', killAudio);
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const visible = () => { if (!document.hidden && v.paused) play(); };
    document.addEventListener('visibilitychange', visible);
    play();
    return () => { document.removeEventListener('visibilitychange', visible); v.removeEventListener('loadedmetadata', killAudio); };
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
