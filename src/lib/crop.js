// Кадрування мініатюри-превʼю: x, y (0..100, % положення в кадрі) і z (масштаб 1..3).
export function cropOf(c) {
  const n = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  return { x: Math.min(100, Math.max(0, n(c && c.x, 50))), y: Math.min(100, Math.max(0, n(c && c.y, 50))), z: Math.min(3, Math.max(1, n(c && c.z, 1))), t: Math.min(60, Math.max(0, n(c && c.t, 0))) };
}
export function cropStyle(c) {
  const { x, y, z } = cropOf(c);
  return { objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, transform: z > 1 ? `scale(${z})` : undefined };
}
// Секунда відео, з якої починається мініатюра (перший кадр).
export function startOf(c) { return cropOf(c).t; }
