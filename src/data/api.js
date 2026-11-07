// Єдине місце доступу до даних.
// Зараз читаємо JSON з репозиторію. Коли з'явиться Supabase або власний API,
// міняється лише цей файл, сторінки не чіпаємо.
import exercises from './exercises.json';
import muscles from './muscles.json';
import schedule from './schedule.json';

export const CATEGORIES = {
  fitness: { title: 'Вправи фітнес', hint: 'Силові та кардіо з відео' },
  mfr: { title: 'МФР ролл', hint: 'Масаж роликом, відновлення' },
  mobility: { title: 'Мобільність', hint: 'Розтяжка та рухливість суглобів' }
};

export async function getExercises({ category, muscle } = {}) {
  return exercises.filter(
    (e) => (!category || e.category === category) && (!muscle || e.muscles.includes(muscle))
  );
}

export async function getExercise(id) {
  return exercises.find((e) => e.id === id) || null;
}

export async function getMuscles() {
  return muscles;
}

export async function getSchedule() {
  return schedule;
}
