// Формула Міффліна — Сан Жеора: базовий обмін (ккал/день у спокої) і денна норма з коефіцієнтом активності.
export const LEVELS = [
  { id: 'sedentary', k: 1.2 },
  { id: 'light', k: 1.375 },
  { id: 'moderate', k: 1.55 },
  { id: 'high', k: 1.725 },
  { id: 'extra', k: 1.9 }
];

export function bodyOf(d) {
  const x = d || {};
  return {
    gender: x.gender === 'male' || x.gender === 'female' ? x.gender : '',
    weight: Number(x.weight_kg) || 0,
    height: Number(x.height_cm) || 0,
    year: Number(x.birth_year) || 0
  };
}
export const complete = (b) => !!(b.gender && b.weight && b.height && b.year);

export function bmr(b) {
  const age = new Date().getFullYear() - b.year;
  return 10 * b.weight + 6.25 * b.height - 5 * age + (b.gender === 'male' ? 5 : -161);
}
export const round10 = (n) => Math.round(n / 10) * 10;
