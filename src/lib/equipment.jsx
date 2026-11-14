import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase.js';
import { useAuth } from '../auth/index.jsx';

// Інвентар: довідник (таблиця equipment), власний інвентар учня (student_equipment; для гостя лише в браузері)
// і перемикач «Тільки доступні». Усе кешується в localStorage, тож працює й офлайн.
const LIST_KEY = 'equip:list:v1';
const MINE_KEY = 'equip:mine:';
const ONLY_KEY = 'equip:only';

const read = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : d;
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

const Ctx = createContext(null);

export function EquipmentProvider({ children }) {
  const { user } = useAuth();
  const uid = user ? user.id : '';
  const [list, setList] = useState(() => read(LIST_KEY, []));
  const [mine, setMineState] = useState(() => read(MINE_KEY + (uid || 'guest'), []));
  const [only, setOnlyState] = useState(() => read(ONLY_KEY, false));

  const reloadList = useCallback(async () => {
    const { data, error } = await supabase.from('equipment').select('*').order('position').order('created_at');
    if (!error && data) {
      setList(data);
      write(LIST_KEY, data);
    }
  }, []);

  useEffect(() => {
    reloadList();
  }, [reloadList]);

  // Власний інвентар: з бази для учня, з браузера для гостя.
  useEffect(() => {
    setMineState(read(MINE_KEY + (uid || 'guest'), []));
    if (!uid) return undefined;
    let dead = false;
    supabase
      .from('student_equipment')
      .select('items')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (dead || !data) return;
        setMineState(data.items || []);
        write(MINE_KEY + uid, data.items || []);
      });
    return () => {
      dead = true;
    };
  }, [uid]);

  const setMine = useCallback(
    async (items) => {
      setMineState(items);
      write(MINE_KEY + (uid || 'guest'), items);
      if (uid) {
        await supabase.from('student_equipment').upsert({ user_id: uid, items, updated_at: new Date().toISOString() });
      }
    },
    [uid]
  );

  const setOnly = useCallback((v) => {
    setOnlyState(v);
    write(ONLY_KEY, v);
  }, []);

  const value = useMemo(() => {
    const byId = Object.fromEntries(list.map((e) => [e.id, e]));
    const have = new Set(mine);
    // Потрібний інвентар вправи (лише ті id, що є в довіднику) і чого учневі не вистачає.
    const needed = (ex) => ((ex && ex.equipment) || []).filter((id) => byId[id]);
    const missing = (ex) => needed(ex).filter((id) => !have.has(id));
    return { list, byId, mine: have, setMine, only, setOnly, needed, missing, reloadList };
  }, [list, mine, only, setMine, setOnly, reloadList]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEquipment() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEquipment поза EquipmentProvider');
  return v;
}
