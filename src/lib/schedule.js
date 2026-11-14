import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { useAuth } from '../auth/index.jsx';
import { weekdayOf } from './dates.js';

const KEY = 'schedule:v1';

const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

// YYYY-MM-DD за місцевим часом
export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Заняття на конкретну дату: щотижневі за днем тижня + одноразові за датою
export function slotsOn(slots, date) {
  const wd = weekdayOf(date);
  const key = iso(date);
  return slots
    .filter((s) => (s.weekday != null ? s.weekday === wd : s.on_date === key))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// Найближче заняття від зараз (до 60 днів уперед)
export function nextOccurrence(slots, now = new Date()) {
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (let i = 0; i < 60; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const list = slotsOn(slots, d).filter((s) => i > 0 || s.start_time >= nowHM);
    if (list.length) return { slot: list[0], date: d, delta: i };
  }
  return null;
}

// Клітинки місяця з понеділка: null для порожніх на початку
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = weekdayOf(first) - 1;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(new Date(year, month, d));
  return cells;
}

const norm = (s) => ({ ...s, start_time: String(s.start_time).slice(0, 5) });

// Розклад із бази. Остання копія лежить у телефоні, тому працює й без інтернету.
export function useSchedule() {
  const { user, ready } = useAuth();
  const uid = user ? user.id : null;
  const [trainers, setTrainers] = useState(() => read(KEY + ':t', []));
  const [slots, setSlots] = useState(() => read(KEY + ':s', []));
  const [mineIds, setMineIds] = useState(() => (uid ? read(`${KEY}:m:${uid}`, []) : []));
  const [myStudios, setMyStudios] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [tr, sl] = await Promise.all([
        supabase.from('trainers').select('*').order('sort').order('created_at'),
        supabase.from('schedule_slots').select('*')
      ]);
      if (tr.error || sl.error) throw tr.error || sl.error;
      const s = (sl.data || []).map(norm);
      setTrainers(tr.data || []);
      setSlots(s);
      write(KEY + ':t', tr.data || []);
      write(KEY + ':s', s);
      if (uid) {
        const my = await supabase.from('slot_students').select('slot_id').eq('student_id', uid);
        const [ms, mc] = await Promise.all([
          supabase.from('student_studios').select('studio_id').eq('student_id', uid),
          supabase.from('student_classes').select('class_id').eq('student_id', uid)
        ]);
        if (!ms.error) setMyStudios((ms.data || []).map((r) => r.studio_id));
        if (!mc.error) setMyClasses((mc.data || []).map((r) => r.class_id));
        if (!my.error) {
          const ids = (my.data || []).map((r) => r.slot_id);
          setMineIds(ids);
          write(`${KEY}:m:${uid}`, ids);
        }
      }
    } catch {
      /* офлайн або таблиць ще немає: лишається копія */
    } finally {
      setLoaded(true);
    }
  }, [uid]);

  useEffect(() => {
    if (!ready) return undefined;
    setMineIds(uid ? read(`${KEY}:m:${uid}`, []) : []);
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [ready, uid, load]);

  // Заняття учня: призначені вручну + ті, що належать його класам (або студії, якщо клас не вказано)
  const mine = slots.filter(
    (s) => mineIds.includes(s.id) || (s.class_id ? myClasses.includes(s.class_id) : s.studio_id && myStudios.includes(s.studio_id))
  );
  return { trainers, slots, mine, loaded, reload: load };
}
