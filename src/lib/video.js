// Приймає повне посилання YouTube або сам код відео.
export function youtubeId(v) {
  const s = (v || '').trim();
  if (!s) return '';
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : s;
}

// "1:15" або "75" -> 75 секунд.
export function parseTime(v) {
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const p = s.split(':').map(Number);
  if (p.some((x) => !Number.isFinite(x) || x < 0)) return 0;
  return Math.round(p.reduce((a, x) => a * 60 + x, 0));
}

export function fmtTime(n) {
  const s = Math.max(0, Math.floor(n || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Список відео вправи (з урахуванням старого одиночного поля video).
export function videosOf(ex) {
  if (ex && Array.isArray(ex.videos) && ex.videos.length) return ex.videos.filter((v) => v && v.id);
  return ex && ex.video ? [{ id: ex.video, label: {}, start: 0, end: 0, loops: 1 }] : [];
}
