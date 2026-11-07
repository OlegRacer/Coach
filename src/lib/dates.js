export const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
export const DAY_LONG = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];

// День тижня 1..7 (Пн = 1)
export function weekdayOf(date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

// Дати поточного тижня від понеділка
export function currentWeek(today = new Date()) {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - (weekdayOf(today) - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

// Найближче тренування: сьогодні (якщо ще не минуло), далі по колу тижня
export function nextSession(schedule, now = new Date()) {
  const today = weekdayOf(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let best = null;
  for (const s of schedule) {
    const [h, m] = s.time.split(':').map(Number);
    let delta = (s.day - today + 7) % 7;
    if (delta === 0 && h * 60 + m < nowMin) delta = 7;
    const score = delta * 1440 + h * 60 + m;
    if (!best || score < best.score) best = { session: s, score, delta };
  }
  return best;
}
