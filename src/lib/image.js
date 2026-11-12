import { supabase } from './supabase.js';

// Публічне посилання на фото учня зі сховища avatars.
export function avatarUrl(path) {
  if (!path) return '';
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

// Квадратне обрізання по центру до 512 px і стиснення в JPEG (~50-100 КБ).
export async function squarePhoto(file, size = 512) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const out = Math.min(size, s);
    const c = document.createElement('canvas');
    c.width = out;
    c.height = out;
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, out, out);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) throw new Error('encode');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
