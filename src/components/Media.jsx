// Прев'ю вправи: GIF, або коротке відео (mp4/webm) що крутиться по колу.
// `src` це шлях відносно public/ (наприклад "media/squat.mp4") або повне посилання https://...
// Відео mp4/webm у 10-20 разів легші за GIF і на iPhone працюють без звуку й автоматично.
const BASE = import.meta.env.BASE_URL;

function resolve(src) {
  return /^https?:\/\//.test(src) ? src : BASE + src.replace(/^\//, '');
}

export default function Media({ src, title }) {
  if (!src) {
    return <div className="media media-empty">Прев'ю ще не додано</div>;
  }
  const url = resolve(src);
  const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  return (
    <div className="media">
      {isVideo ? (
        <video src={url} autoPlay loop muted playsInline preload="metadata" aria-label={title} />
      ) : (
        <img src={url} alt={title} loading="lazy" />
      )}
    </div>
  );
}
