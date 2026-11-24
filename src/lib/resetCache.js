// Скидання кешу на цьому пристрої: збережені копії даних (контент, розклад, доступи), кеш застосунку (service worker).
// Вхід в акаунт, тема, мова, пуш і власні налаштування лишаються.
import { mediaUrl } from './content.jsx';

const PREFIXES = ['content:', 'schedule:', 'equip:list', 'access:', 'exaccess:', 'details:', 'role:'];

// Адреси відео/фото вправ зі збереженого контенту: браузер на ПК тримає їх у власному HTTP-кеші (рік),
// тому видалений файл ще показується. Повторний запит з cache:'reload' перезаписує цей запис.
function mediaUrls() {
  const out = new Set();
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('content:')).forEach((k) => {
      const d = JSON.parse(localStorage.getItem(k));
      ((d && d.exercises) || []).forEach((e) => { if (e && e.preview) out.add(mediaUrl(e.preview)); });
    });
  } catch {
    /* ignore */
  }
  return [...out];
}

export async function resetCache() {
  const urls = mediaUrls();
  try {
    await Promise.all(urls.map((u) => fetch(u, { cache: 'reload', headers: { Range: 'bytes=0-0' } }).catch(() => {})));
  } catch {
    /* ignore */
  }
  try {
    Object.keys(localStorage).filter((k) => PREFIXES.some((p) => k.startsWith(p))).forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  try {
    if (window.caches) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => {})));
    }
  } catch {
    /* ignore */
  }
  window.location.reload();
}
