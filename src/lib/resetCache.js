// Скидання кешу на цьому пристрої: збережені копії даних (контент, розклад, доступи), кеш застосунку (service worker).
// Вхід в акаунт, тема, мова, пуш і власні налаштування лишаються.
const PREFIXES = ['content:', 'schedule:', 'equip:list', 'access:', 'exaccess:', 'details:', 'role:'];

export async function resetCache() {
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
