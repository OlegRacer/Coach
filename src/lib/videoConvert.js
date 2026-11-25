// Конвертер відео для прев'ю вправ — працює прямо в браузері, до завантаження на сервер.
// Відео з айфона (HEVC .mov, 4K, 60 к/с, зі звуком) відтворюється, зменшується до 720 px,
// 30 к/с, без звуку й перекодовується в H.264 .mp4 (або webm, якщо браузер не вміє mp4).
// Кодування іде в реальному часі (відео грає й записується), тому 10 с відео = ~10 с очікування.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export const MAX_SECONDS = 20;
const MAX_SIDE = 1080;
const FPS = 24;

export function canConvertVideo() {
  return hasWebCodecs() || (typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream);
}

function pickMime() {
  const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

// Запасний варіант: запис canvas через MediaRecorder (гірша якість, у реальному часі).
// file -> { blob, type, ext, seconds, trimmed, width, height }
function convertVideoLegacy(file, { maxBytes = 28 * 1024 * 1024, onProgress, signal } = {}) {
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
      const bps = Math.max(2000000, Math.min(5000000, Math.floor(((maxBytes * 8) / seconds) * 0.8)));
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
        resolve({ blob, type, ext: type === 'video/mp4' ? 'mp4' : 'webm', seconds, trimmed: dur > MAX_SECONDS, width: w, height: h, method: 'recorder' });
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

const hasWebCodecs = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof HTMLVideoElement !== 'undefined' && 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

// Основний варіант: H.264 через WebCodecs (змінний бітрейт, ключовий кадр кожні 2 с) і mp4-muxer (faststart).
function convertVideoWC(file, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    let enc = null;
    let done = false;
    const cleanup = () => {
      try { v.pause(); } catch { /* ignore */ }
      v.removeAttribute('src');
      v.load();
      URL.revokeObjectURL(url);
      try { if (enc && enc.state !== 'closed') enc.close(); } catch { /* ignore */ }
    };
    const fail = (e) => {
      if (done) return;
      done = true;
      cleanup();
      reject(e instanceof Error ? e : new Error(String(e)));
    };
    if (signal) signal.addEventListener('abort', () => fail(new Error('aborted')));
    v.onerror = () => fail(new Error('decode'));
    v.onloadedmetadata = async () => {
      try {
        const sw = v.videoWidth;
        const sh = v.videoHeight;
        if (!sw || !sh) throw new Error('decode');
        const dur = v.duration && Number.isFinite(v.duration) ? v.duration : MAX_SECONDS;
        const seconds = Math.min(dur, MAX_SECONDS);
        const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
        const w = Math.max(2, Math.round((sw * k) / 2) * 2);
        const h = Math.max(2, Math.round((sh * k) / 2) * 2);
        const bitrate = Math.max(1200000, Math.min(2800000, Math.round(w * h * FPS * 0.06)));
        let cfg = null;
        for (const codec of ['avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.4D0028', 'avc1.42E01F']) {
          const c = { codec, width: w, height: h, bitrate, framerate: FPS, bitrateMode: 'variable', latencyMode: 'quality', avc: { format: 'avc' } };
          try {
            const r = await VideoEncoder.isConfigSupported(c);
            if (r && r.supported) { cfg = r.config || c; break; }
          } catch { /* наступний */ }
        }
        if (!cfg) throw new Error('unsupported');
        const target = new ArrayBufferTarget();
        const muxer = new Muxer({ target, video: { codec: 'avc', width: w, height: h, frameRate: FPS }, fastStart: 'in-memory' });
        let encErr = null;
        enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { encErr = e; } });
        enc.configure(cfg);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { alpha: false });
        const step = 1 / FPS;
        let next = 0;
        let n = 0;
        let t0 = null;
        const finish = async () => {
          if (done) return;
          try {
            if (encErr) throw encErr;
            await enc.flush();
            if (encErr) throw encErr;
            if (!n) throw new Error('decode');
            muxer.finalize();
            done = true;
            const blob = new Blob([target.buffer], { type: 'video/mp4' });
            cleanup();
            resolve({ blob, type: 'video/mp4', ext: 'mp4', seconds, trimmed: dur > MAX_SECONDS, width: w, height: h, method: 'webcodecs' });
          } catch (e) {
            fail(e);
          }
        };
        const onFrame = async (_now, md) => {
          if (done) return;
          if (encErr) return fail(encErr);
          if (t0 === null) t0 = md.mediaTime;
          const t = md.mediaTime - t0;
          if (t >= seconds - 1e-3 || v.ended) return finish();
          if (t + 1e-4 >= next) {
            ctx.drawImage(v, 0, 0, w, h);
            const frame = new VideoFrame(canvas, { timestamp: Math.round(n * step * 1e6), duration: Math.round(step * 1e6) });
            enc.encode(frame, { keyFrame: n % (FPS * 2) === 0 });
            frame.close();
            n += 1;
            next = n * step;
            if (onProgress) onProgress(Math.min(1, t / seconds));
            while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 5));
          }
          v.requestVideoFrameCallback(onFrame);
        };
        v.onended = () => finish();
        v.requestVideoFrameCallback(onFrame);
        await v.play();
      } catch (e) {
        fail(e);
      }
    };
    v.src = url;
  });
}

// file -> { blob, type, ext, seconds, trimmed, width, height }. Спершу WebCodecs, за потреби запасний запис.
export async function convertVideo(file, opts = {}) {
  if (hasWebCodecs()) {
    try {
      return await convertVideoWC(file, opts);
    } catch (e) {
      if (e && e.message === 'aborted') throw e;
      if (typeof MediaRecorder === 'undefined') throw e;
    }
  }
  return convertVideoLegacy(file, opts);
}
