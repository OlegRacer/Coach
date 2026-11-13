import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';

// Прев'ю вправи: GIF, або коротке відео (mp4/webm) що крутиться по колу.
// `src` це шлях відносно public/ (наприклад "media/squat.mp4") або повне посилання https://...
// Відео mp4/webm у 10-20 разів легші за GIF і на iPhone працюють без звуку й автоматично.
const BASE = import.meta.env.BASE_URL;

function resolve(src) {
  return /^https?:\/\//.test(src) ? src : BASE + src.replace(/^\//, '');
}

// Відео-прев'ю крутиться по колу. На iPhone зациклення потокового відео (кожен виток це новий запит до сервера)
// інколи підвисає на кінці. Тому відео паралельно повністю вантажимо в пам'ять (до 30 МБ) і після цього
// граємо вже з пам'яті на початку наступного витка: кінець більше не залежить від мережі.
// Якщо автозапуск заблоковано (економія заряду), відео запускається по дотику.
function LoopVideo({ url, title }) {
  const ref = useRef(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    let blobUrl = '';
    let pending = '';
    let dead = false;
    v.muted = true;
    v.loop = true;
    const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
    const swap = () => {
      if (!pending || dead) return;
      blobUrl = pending;
      pending = '';
      v.src = blobUrl;
      v.muted = true;
      v.loop = true;
      play();
    };
    const tick = () => { if (pending && v.currentTime < 0.4) swap(); };
    const visible = () => { if (!document.hidden && v.paused) play(); };
    v.addEventListener('timeupdate', tick);
    v.addEventListener('loadeddata', play);
    document.addEventListener('visibilitychange', visible);
    play();
    if (typeof fetch === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
      fetch(url)
        .then((r) => (r.ok ? r.blob() : null))
        .then((blob) => {
          if (!blob || dead || blob.size > 40 * 1024 * 1024) return;
          pending = URL.createObjectURL(blob);
          if (v.paused) swap();
        })
        .catch(() => {});
    }
    return () => {
      dead = true;
      v.removeEventListener('timeupdate', tick);
      v.removeEventListener('loadeddata', play);
      document.removeEventListener('visibilitychange', visible);
      if (pending) URL.revokeObjectURL(pending);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
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
