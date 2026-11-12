import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import seed from '../data/content-seed.json';
import { GROUPS, expand } from './muscles.js';
import { supabase } from './supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Контент (розділи й вправи) живе в базі. Додаток тримає знімок у localStorage:
// без інтернету працює з нього, з інтернетом спершу питає короткий підпис (content_sig)
// і качає повний знімок лише коли підпис змінився.
// Перший запуск без інтернету бере стартовий знімок із src/data/content-seed.json.
const ContentContext = createContext(null);

const read = (k, fb) => {
  try {
    const v = JSON.parse(localStorage.getItem(k));
    return v ?? fb;
  } catch {
    return fb;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

// Текст з {uk,en,zh-TW}: поточна мова, інакше українська, інакше що є.
export function pick(obj, lang) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.uk || obj.en || obj['zh-TW'] || '';
}

export function mediaUrl(src) {
  if (!src) return '';
  if (/^https?:\/\//.test(src) || src.startsWith('media/')) return src; // media/… лежить у public/ додатка
  const { data } = supabase.storage.from('content').getPublicUrl(src);
  return data.publicUrl;
}

export function ContentProvider({ children }) {
  const { user, isAdmin, access, exAccess, hasAccess, hasExercise } = useAuth();
  const uid = user ? user.id : '';
  const key = 'content:v1:' + (uid || 'guest');
  const [data, setData] = useState(() => read(key, seed));
  const [loaded, setLoaded] = useState(false);
  const busy = useRef(false);

  // Інший користувач чи гість: беремо його кеш.
  useEffect(() => {
    setData(read(key, seed));
    setLoaded(false);
  }, [key]);

  const check = useCallback(
    async (force) => {
      if (busy.current || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
      busy.current = true;
      try {
        const cached = read(key, null);
        // Незбережений локальний порядок розділів (був офлайн): відправляємо.
        const pend = uid && read('content-order-pending:' + uid, null);
        if (pend) {
          const { error } = await supabase
            .from('user_section_order')
            .upsert({ user_id: uid, sections: pend, updated_at: new Date().toISOString() });
          if (!error) write('content-order-pending:' + uid, null);
        }
        let need = force || !cached || cached.sig === 'seed';
        if (!need) {
          const { data: sig, error } = await supabase.rpc('content_sig');
          if (error) return;
          need = sig !== cached.sig;
        }
        if (need) {
          const { data: snap, error } = await supabase.rpc('get_content');
          if (error || !snap || !Array.isArray(snap.sections) || !Array.isArray(snap.exercises)) return;
          write(key, snap);
          setData(snap);
        }
        setLoaded(true);
      } catch {
        /* офлайн або збій мережі: лишається кеш */
      } finally {
        busy.current = false;
      }
    },
    [key, uid]
  );

  const accessSig = JSON.stringify([access || {}, exAccess || {}]);
  useEffect(() => {
    check(false);
  }, [check, accessSig, isAdmin]);
  useEffect(() => {
    const on = () => document.visibilityState === 'visible' && check(false);
    document.addEventListener('visibilitychange', on);
    window.addEventListener('online', on);
    return () => {
      document.removeEventListener('visibilitychange', on);
      window.removeEventListener('online', on);
    };
  }, [check]);

  // Порядок розділів для цього учня: його власний, решта за порядком тренера.
  const sections = useMemo(() => {
    const order = Array.isArray(data.order) ? data.order : [];
    const idx = (id) => {
      const i = order.indexOf(id);
      return i < 0 ? 1e6 : i;
    };
    return data.sections
      .filter((s) => !s.parent_id)
      .map((s, i) => ({ s, i }))
      .sort((a, b) => idx(a.s.id) - idx(b.s.id) || a.i - b.i)
      .map((x) => x.s);
  }, [data]);

  const setOrder = useCallback(
    async (ids) => {
      const next = { ...read(key, data), order: ids };
      write(key, next);
      setData(next);
      if (!uid) return;
      const { error } = await supabase
        .from('user_section_order')
        .upsert({ user_id: uid, sections: ids, updated_at: new Date().toISOString() });
      write('content-order-pending:' + uid, error ? ids : null);
    },
    [key, data, uid]
  );

  // Дерево розділів: розділ може містити підрозділи і вправи на будь-яку глибину.
  const tree = useMemo(() => {
    const byId = new Map(data.sections.map((s) => [s.id, s]));
    const kids = new Map();
    data.sections.forEach((s) => {
      const k = s.parent_id || '';
      kids.set(k, [...(kids.get(k) || []), s]);
    });
    const chainOf = (id) => {
      const out = [];
      const seen = new Set();
      let cur = byId.get(id);
      while (cur && !seen.has(cur.id)) {
        seen.add(cur.id);
        out.unshift(cur);
        cur = cur.parent_id ? byId.get(cur.parent_id) : null;
      }
      return out;
    };
    const subtreeIds = (id) => {
      const out = [id];
      for (let i = 0; i < out.length; i++) (kids.get(out[i]) || []).forEach((c) => !out.includes(c.id) && out.push(c.id));
      return out;
    };
    return { kids, chainOf, subtreeIds };
  }, [data]);

  const value = useMemo(() => {
    const { kids, chainOf, subtreeIds } = tree;
    // Розділ відкрито повністю: доступ (чи «безкоштовно») на ньому або на будь-якому предку.
    const sectionOpen = (id) => isAdmin || chainOf(id).some((a) => a.free || hasAccess(a.id));
    const exerciseOpen = (e) => !!e && !e.locked && (isAdmin || e.free || hasExercise(e.id) || sectionOpen(e.section_id));
    const exercisesIn = (id) => {
      const ids = new Set(subtreeIds(id));
      return data.exercises.filter((e) => ids.has(e.section_id));
    };
    return {
      loaded,
      sections, // у порядку учня
      rawSections: data.sections, // усі розділи, у порядку тренера (для адмінки)
      childrenOf: (id) => kids.get(id || '') || [],
      chainOf,
      isFreeSection: (id) => chainOf(id).some((a) => a.free),
      sectionOpen,
      exerciseOpen,
      exercisesIn, // усі видимі вправи розділу разом з підрозділами
      openCount: (id) => exercisesIn(id).filter(exerciseOpen).length,
      subtreeIds,
      exercises: data.exercises,
      muscles: GROUPS,
      reload: () => check(true),
      setOrder,
      section: (id) => data.sections.find((s) => s.id === id) || null,
      exercisesOf: (sectionId) => data.exercises.filter((e) => e.section_id === sectionId),
      exercise: (id) => data.exercises.find((e) => e.id === id) || null,
      // Вправи, що працюють хоч одну з вибраних зон (групу чи півзону).
      exercisesByMuscles: (ids) => {
        const want = expand(ids);
        return data.exercises.filter((e) => !e.locked && [...expand(e.muscles || [])].some((l) => want.has(l)));
      }
    };
  }, [data, tree, sections, loaded, check, setOrder, isAdmin, hasAccess, hasExercise]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  return useContext(ContentContext);
}

// Зручний текст з об'єкта-поля поточною мовою.
export function useL() {
  const { lang } = useI18n();
  return useCallback((obj) => pick(obj, lang), [lang]);
}
