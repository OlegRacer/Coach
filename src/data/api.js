// Єдине місце доступу до даних.
// Зараз читаємо JSON з репозиторію. Коли з'явиться Supabase або власний API,
// міняється лише цей файл, сторінки не чіпаємо.
// Тексти (назви, описи) лежать у src/locales/*.json, тут тільки дані без мови.
import exercises from './exercises.json';
import muscles from './muscles.json';
import schedule from './schedule.json';

export const CATEGORIES = ['fitness', 'mfr', 'mobility'];

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
