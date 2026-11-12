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

// Блоки відео: фрагменти, що грають по черзі. Кожен: {start, end, loops}. end 0 = до кінця, loops 0 = безкінечно.
// Старі записи без blocks мають один блок із полів start/end/loops.
export function blocksOf(v) {
  if (v && Array.isArray(v.blocks) && v.blocks.length) {
    return v.blocks.map((b) => ({ start: Number(b.start) || 0, end: Number(b.end) || 0, loops: b.loops === undefined || b.loops === null ? 1 : Number(b.loops) }));
  }
  return [{ start: Number(v && v.start) || 0, end: Number(v && v.end) || 0, loops: v && v.loops !== undefined && v.loops !== null ? Number(v.loops) : 1 }];
}

// Список відео вправи (з урахуванням старого одиночного поля video).
export function videosOf(ex) {
  const list = ex && Array.isArray(ex.videos) && ex.videos.length ? ex.videos : ex && ex.video ? [{ id: ex.video, label: {} }] : [];
  return list.filter((v) => v && v.id).map((v) => ({ ...v, blocks: blocksOf(v) }));
}
