// Підключається до сервіс-воркера (vite.config.js, workbox.importScripts).
// Відео/фото з Supabase Storage (content, avatars) завантажуються цілком ОДИН раз і далі віддаються з кешу пристрою,
// у тому числі частинами (Range), які просить <video>. Так трафік Supabase не росте від кожного перегляду.
// Шлях файлу містить час завантаження, тож новий файл завжди має нову адресу, а старий кеш не застаріває.
const MEDIA_CACHE = 'media-v1';
const MEDIA_MAX = 400;
const MEDIA_MAX_BYTES = 40 * 1024 * 1024;
const inflight = new Map();

function isMedia(u) {
  return /\/storage\/v1\/object\/public\/(content|avatars)\//.test(u.pathname);
}

async function download(cache, key) {
  if (inflight.has(key)) return inflight.get(key).then((r) => r && r.clone());
  const p = (async () => {
    const res = await fetch(key); // без Range: потрібен весь файл
    if (!res || res.status !== 200) return null;
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MEDIA_MAX_BYTES) return null;
    await cache.put(key, res.clone());
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - MEDIA_MAX; i++) await cache.delete(keys[i]);
    return res;
  })();
  inflight.set(key, p);
  try {
    const r = await p;
    return r && r.clone();
  } finally {
    inflight.delete(key);
  }
}

async function rangeOf(res, header) {
  const m = /bytes=(\d*)-(\d*)/.exec(header || '');
  if (!m) return res;
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  let end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  const part = buf.slice(start, end + 1);
  return new Response(part, {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'video/mp4',
      'Content-Length': String(part.byteLength),
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes'
    }
  });
}

async function handleMedia(req, u) {
  const key = u.origin + u.pathname;
  try {
    const cache = await caches.open(MEDIA_CACHE);
    let hit = await cache.match(key);
    if (!hit) hit = await download(cache, key);
    if (!hit) return fetch(req);
    return req.headers.has('range') ? await rangeOf(hit, req.headers.get('range')) : hit;
  } catch (e) {
    return fetch(req);
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (!isMedia(u)) return;
  event.respondWith(handleMedia(req, u));
});
