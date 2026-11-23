import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { useAuth } from '../auth/index.jsx';
import { weekdayOf } from './dates.js';
import { useL } from './content.jsx';
import { itemDate } from './challenges.js';

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

// Заняття на конкретну дату: щотижневі за днем тижня + одноразові за датою.
// Враховує паузу серії (pause_from..pause_to) та винятки: скасовані й перенесені дати.
export function slotsOn(slots, date) {
  const wd = weekdayOf(date);
  const key = iso(date);
  const out = [];
  slots.forEach((s) => {
    const ex = s.ex || {};
    const base = s.weekday != null ? s.weekday === wd : s.on_date === key;
    const paused = s.pause_from && s.pause_to && key >= s.pause_from && key <= s.pause_to;
    if (base && !paused && !ex[key]) out.push(s);
    Object.keys(ex).forEach((orig) => {
      const e = ex[orig];
      if (e.kind === 'move' && e.new_date === key) {
        out.push({ ...s, id: `${s.id}@${orig}`, moved: true, orig_date: orig, start_time: e.new_time || s.start_time });
      }
    });
  });
  return out.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

// Найближче заняття від зараз (до 60 днів уперед)
export function nextOccurrence(slots, now = new Date()) {
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (let i = 0; i < 60; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const list = slotsOn(slots, d).filter((s) => i > 0 || s.start_time >= nowHM || (s.personal && s.start_time === '00:00'));
    if (list.length) return { slot: list[0], date: d, delta: i };
  }
  return null;
}

// Найближче заняття одного класу (до ~400 днів уперед); null, якщо більше не буде
export function nextOf(slot, now = new Date(), days = 400) {
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const list = slotsOn([slot], d).filter((x) => i > 0 || x.start_time >= nowHM);
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

// Власний пункт учня → форма заняття розкладу
const pathFor = (r) => (r.kind === 'exercise' ? `/exercise/${r.ref_id}` : r.kind === 'section' ? `/section/${r.ref_id}` : r.kind === 'program' ? `/program/${r.ref_id}` : '');
const normPersonal = (r) => ({
  id: 'p:' + r.id,
  pid: r.id,
  personal: true,
  kind: r.kind,
  title: r.title,
  place: r.place || '',
  to: pathFor(r),
  weekday: r.weekday,
  on_date: r.on_date,
  start_time: String(r.start_time).slice(0, 5),
  duration_min: r.duration_min,
  trainer_id: null
});

const norm = (s, ex = {}) => ({ ...s, start_time: String(s.start_time).slice(0, 5), ex });

// Розклад із бази. Остання копія лежить у телефоні, тому працює й без інтернету.
export function useSchedule() {
  const { user, ready } = useAuth();
  const uid = user ? user.id : null;
  const [trainers, setTrainers] = useState(() => read(KEY + ':t', []));
  const [slots, setSlots] = useState(() => read(KEY + ':s', []));
  const [studios, setStudios] = useState(() => read(KEY + ':g', []));
  const [mineIds, setMineIds] = useState(() => (uid ? read(`${KEY}:m:${uid}`, []) : []));
  const [myStudios, setMyStudios] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [personal, setPersonal] = useState(() => (uid ? read(`${KEY}:p:${uid}`, []) : []));
  const [chal, setChal] = useState(() => (uid ? read(`${KEY}:c:${uid}`, null) : null));
  const [loaded, setLoaded] = useState(false);
  const L = useL();

  const load = useCallback(async () => {
    try {
      const [tr, sl, xs] = await Promise.all([
        supabase.from('trainers').select('*').order('sort').order('created_at'),
        supabase.from('schedule_slots').select('*'),
        supabase.from('slot_exceptions').select('*')
      ]);
      if (tr.error || sl.error) throw tr.error || sl.error;
      const byId = {};
      (xs.error ? [] : xs.data || []).forEach((e) => {
        (byId[e.slot_id] = byId[e.slot_id] || {})[e.orig_date] = { kind: e.kind, new_date: e.new_date, new_time: e.new_time ? String(e.new_time).slice(0, 5) : null };
      });
      const s = (sl.data || []).map((x) => norm(x, byId[x.id]));
      setTrainers(tr.data || []);
      setSlots(s);
      const st = await supabase.from('studios').select('id,name');
      if (!st.error) {
        setStudios(st.data || []);
        write(KEY + ':g', st.data || []);
      }
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
        const pi = await supabase.from('student_plan_items').select('*').eq('student_id', uid);
        if (!pi.error) {
          const list = (pi.data || []).map(normPersonal);
          setPersonal(list);
          write(`${KEY}:p:${uid}`, list);
        }
        // Челенджі, у яких учень бере участь: заняття стають звичайними пунктами розкладу
        const cm = await supabase.from('challenge_members').select('*').eq('student_id', uid).eq('status', 'active');
        if (!cm.error) {
          const cids = (cm.data || []).map((m) => m.challenge_id);
          let cs = [], ci = [], cd = [];
          if (cids.length) {
            const [a, b, c] = await Promise.all([
              supabase.from('challenges').select('id,title').in('id', cids),
              supabase.from('challenge_items').select('*').in('challenge_id', cids),
              supabase.from('challenge_done').select('item_id').eq('student_id', uid)
            ]);
            cs = a.data || [];
            ci = b.data || [];
            cd = (c.data || []).map((x) => x.item_id);
          }
          const pack = { members: cm.data || [], challenges: cs, items: ci, done: cd };
          setChal(pack);
          write(`${KEY}:c:${uid}`, pack);
        }
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
    setPersonal(uid ? read(`${KEY}:p:${uid}`, []) : []);
    setChal(uid ? read(`${KEY}:c:${uid}`, null) : null);
    load();
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('schedule:changed', load);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('schedule:changed', load);
    };
  }, [ready, uid, load]);

  // Заняття учня: призначені вручну + ті, що належать його класам (або студії, якщо клас не вказано)
  const assigned = slots.filter(
    (s) => mineIds.includes(s.id) || (s.class_id ? myClasses.includes(s.class_id) : s.studio_id && myStudios.includes(s.studio_id))
  );
  const chalItems = useMemo(() => {
    if (!chal) return [];
    const out = [];
    chal.items.forEach((it) => {
      const m = chal.members.find((x) => x.challenge_id === it.challenge_id);
      const c = chal.challenges.find((x) => x.id === it.challenge_id);
      if (!m || !c) return;
      out.push({
        id: 'c:' + it.id,
        challenge: true,
        itemId: it.id,
        personal: true,
        done: chal.done.includes(it.id),
        title: L(it.title) || L(c.title),
        place: L(c.title),
        to: it.ref_kind === 'exercise' ? `/exercise/${it.ref_id}` : it.ref_kind === 'section' ? `/section/${it.ref_id}` : '/plans',
        weekday: null,
        on_date: itemDate(m.start_date, it.day_no),
        start_time: String(it.start_time).slice(0, 5),
        duration_min: it.duration_min,
        trainer_id: null
      });
    });
    return out;
  }, [chal, L]);
  const mine = [...assigned, ...personal, ...chalItems];
  return { trainers, studios, slots, mine, loaded, reload: load };
}
