// Конвертер відео для прев'ю вправ — працює прямо в браузері, до завантаження на сервер.
// Відео з айфона (HEVC .mov, 4K, 60 к/с, зі звуком) відтворюється, зменшується до 720 px,
// 30 к/с, без звуку й перекодовується в H.264 .mp4 (або webm, якщо браузер не вміє mp4).
// Кодування іде в реальному часі (відео грає й записується), тому 10 с відео = ~10 с очікування.
export const MAX_SECONDS = 20;
const MAX_SIDE = 720;
const FPS = 30;

export function canConvertVideo() {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
}

function pickMime() {
  const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// file -> { blob, type, ext, seconds, trimmed, width, height }
export function convertVideo(file, { maxBytes = 28 * 1024 * 1024, onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const mime = pickMime();
    if (!mime) return reject(new Error('unsupported'));
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    let rec = null;
    let done = false;
    let raf = 0;
    const cleanup = () => {
      cancelAnimationFrame(raf);
      try {
        v.pause();
      } catch {
        /* ignore */
      }
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
    };
    const fail = (e) => {
      if (done) return;
      done = true;
      cleanup();
      try {
        if (rec && rec.state !== 'inactive') rec.stop();
      } catch {
        /* ignore */
      }
      reject(e instanceof Error ? e : new Error(String(e)));
    };
    if (signal) signal.addEventListener('abort', () => fail(new Error('aborted')));
    v.onerror = () => fail(new Error('decode'));
    v.onloadedmetadata = () => {
      const sw = v.videoWidth;
      const sh = v.videoHeight;
      if (!sw || !sh) return fail(new Error('decode'));
      const dur = v.duration && Number.isFinite(v.duration) ? v.duration : MAX_SECONDS;
      const seconds = Math.min(dur, MAX_SECONDS);
      const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
      const w = Math.max(2, Math.round((sw * k) / 2) * 2);
      const h = Math.max(2, Math.round((sh * k) / 2) * 2);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      const bps = Math.max(1500000, Math.min(6000000, Math.floor(((maxBytes * 8) / seconds) * 0.8)));
      const stream = canvas.captureStream(FPS);
      const chunks = [];
      try {
        rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bps });
      } catch (e) {
        return fail(e);
      }
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      rec.onerror = () => fail(new Error('record'));
      rec.onstop = () => {
        if (done) return;
        done = true;
        cleanup();
        const type = mime.split(';')[0];
        const blob = new Blob(chunks, { type });
        resolve({ blob, type, ext: type === 'video/mp4' ? 'mp4' : 'webm', seconds, trimmed: dur > MAX_SECONDS, width: w, height: h });
      };
      const draw = () => {
        if (done) return;
        ctx.drawImage(v, 0, 0, w, h);
        if (onProgress) onProgress(Math.min(1, v.currentTime / seconds));
        if (v.ended || v.currentTime >= seconds) {
          if (rec.state !== 'inactive') setTimeout(() => rec.state !== 'inactive' && rec.stop(), 120);
          return;
        }
        if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(draw);
        else raf = requestAnimationFrame(draw);
      };
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      // запис стартує лише після першого справжнього кадру, щоб відео не починалось із чорного
      const begin = () => {
        if (done) return;
        ctx.drawImage(v, 0, 0, w, h);
        rec.start(500);
        draw();
      };
      v.play()
        .then(() => {
          if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(begin);
          else setTimeout(begin, 80);
        })
        .catch(fail);
      v.onended = () => {
        if (!done && rec.state !== 'inactive') setTimeout(() => rec.state !== 'inactive' && rec.stop(), 120);
      };
    };
    v.src = url;
  });
}
