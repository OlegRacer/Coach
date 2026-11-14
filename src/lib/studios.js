import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Студії, їхні класи та вибір учня. Таблиць може ще не бути — тоді все порожнє.
export function useStudioData(uid) {
  const [studios, setStudios] = useState([]);
  const [classes, setClasses] = useState([]);
  const [myStudios, setMyStudios] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, cl] = await Promise.all([
        supabase.from('studios').select('*').order('sort').order('created_at'),
        supabase.from('studio_classes').select('*').order('sort').order('created_at')
      ]);
      setStudios(st.error ? [] : st.data || []);
      setClasses(cl.error ? [] : cl.data || []);
      if (uid) {
        const [a, b] = await Promise.all([
          supabase.from('student_studios').select('studio_id').eq('student_id', uid),
          supabase.from('student_classes').select('class_id').eq('student_id', uid)
        ]);
        setMyStudios(a.error ? [] : (a.data || []).map((r) => r.studio_id));
        setMyClasses(b.error ? [] : (b.data || []).map((r) => r.class_id));
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

  return { studios, classes, myStudios, myClasses, loaded, reload: load };
}

// Зберегти вибір учня: студії та класи
export async function saveStudioChoice(uid, studioIds, classIds) {
  const d1 = await supabase.from('student_studios').delete().eq('student_id', uid);
  if (d1.error) return d1.error;
  if (studioIds.length) {
    const i1 = await supabase.from('student_studios').insert(studioIds.map((id) => ({ student_id: uid, studio_id: id })));
    if (i1.error) return i1.error;
  }
  const d2 = await supabase.from('student_classes').delete().eq('student_id', uid);
  if (d2.error) return d2.error;
  if (classIds.length) {
    const i2 = await supabase.from('student_classes').insert(classIds.map((id) => ({ student_id: uid, class_id: id })));
    if (i2.error) return i2.error;
  }
  return null;
}

// Панель вибору студій і класів (для анкети й адмінки). value = {studios, classes, other}
export function pickStudio(value, studioId, classes) {
  const on = value.studios.includes(studioId);
  const drop = classes.filter((c) => c.studio_id === studioId).map((c) => c.id);
  return {
    other: false,
    studios: on ? value.studios.filter((x) => x !== studioId) : [...value.studios, studioId],
    classes: on ? value.classes.filter((x) => !drop.includes(x)) : value.classes
  };
}
