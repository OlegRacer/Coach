// Мініатюра-кадр для відео вправи (маленька картинка), щоб у списках не вантажити саме відео.
// Адреса виводиться з шляху відео й секунди першого кадру: <шлях без розширення>.t<сотих секунди>.jpg
import { supabase } from './supabase.js';
import { mediaUrl } from './content.jsx';
import { startOf } from './crop.js';

const SIZE = 240;

export function posterPath(preview, crop) {
  if (!preview || /^https?:\/\//.test(preview) || preview.startsWith('media/')) return '';
  if (!/\.(mp4|webm|mov|m4v)$/i.test(preview)) return '';
  return preview.replace(/\.[^./]+$/, '') + '.t' + Math.round((startOf(crop) || 0) * 100) + '.jpg';
}
export function posterUrl(preview, crop) {
  const p = posterPath(preview, crop);
  return p ? mediaUrl(p) : '';
}

function frameBlob(url, t) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    const fail = () => reject(new Error('poster'));
    v.onerror = fail;
    v.onloadeddata = () => {
      v.onseeked = () => {
        try {
          const k = Math.min(1, SIZE / Math.max(v.videoWidth, v.videoHeight));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(v.videoWidth * k));
          c.height = Math.max(1, Math.round(v.videoHeight * k));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          c.toBlob((b) => (b ? resolve(b) : fail()), 'image/jpeg', 0.8);
        } catch (e) {
          fail();
        }
      };
      v.currentTime = t || 0.001;
    };
    v.src = url;
  });
}

// Створює мініатюру, якщо її ще немає. Повертає true, якщо щось вивантажено.
export async function ensurePoster(preview, crop) {
  const path = posterPath(preview, crop);
  if (!path) return false;
  try {
    const head = await fetch(mediaUrl(path), { method: 'HEAD', cache: 'no-store' });
    if (head.ok) return false;
  } catch {
    /* спробуємо створити */
  }
  const blob = await frameBlob(mediaUrl(preview), startOf(crop));
  const { error } = await supabase.storage.from('content').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (error && !/exists|duplicate/i.test(error.message)) throw error;
  return true;
}
