import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Студії, заняття, тренери та вибір учня (студії + класи). Таблиць може ще не бути — тоді все порожнє.
export function useStudioData(uid) {
  const [studios, setStudios] = useState([]);
  const [slots, setSlots] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [myStudios, setMyStudios] = useState([]);
  const [mySlots, setMySlots] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, sl, tr] = await Promise.all([
        supabase.from('studios').select('*').order('sort').order('created_at'),
        supabase.from('schedule_slots').select('*').order('start_time'),
        supabase.from('trainers').select('id, name')
      ]);
      setStudios(st.error ? [] : st.data || []);
      setSlots(sl.error ? [] : (sl.data || []).map((s) => ({ ...s, start_time: String(s.start_time).slice(0, 5) })));
      setTrainers(tr.error ? [] : tr.data || []);
      if (uid) {
        const [a, b] = await Promise.all([
          supabase.from('student_studios').select('studio_id').eq('student_id', uid),
          supabase.from('slot_students').select('slot_id').eq('student_id', uid)
        ]);
        setMyStudios(a.error ? [] : (a.data || []).map((r) => r.studio_id));
        setMySlots(b.error ? [] : (b.data || []).map((r) => r.slot_id));
      }
    } catch {
      /* офлайн */
    } finally {
      setLoaded(true);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  return { studios, slots, trainers, myStudios, mySlots, loaded, reload: load };
}

// Підпис заняття: «Пн 18:00 · Йога · Тренер»
export function slotLabel(s, trainers, t) {
  const when = s.weekday != null ? t(`day.short.${s.weekday}`) : s.on_date;
  const tr = trainers.find((x) => x.id === s.trainer_id);
  return [`${when} ${s.start_time}`, s.title, tr && tr.name].filter(Boolean).join(' · ');
}

// Зберегти вибір учня: студії та класи
export async function saveStudioChoice(uid, studioIds, slotIds, allSlotIds) {
  const d1 = await supabase.from('student_studios').delete().eq('student_id', uid);
  if (d1.error) return d1.error;
  if (studioIds.length) {
    const i1 = await supabase.from('student_studios').insert(studioIds.map((id) => ({ student_id: uid, studio_id: id })));
    if (i1.error) return i1.error;
  }
  const d2 = await supabase.from('slot_students').delete().eq('student_id', uid);
  if (d2.error) return d2.error;
  if (slotIds.length) {
    const i2 = await supabase.from('slot_students').insert(slotIds.map((id) => ({ student_id: uid, slot_id: id })));
    if (i2.error) return i2.error;
  }
  return null;
}
