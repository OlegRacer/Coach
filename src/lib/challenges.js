import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { useAuth } from '../auth/index.jsx';

// Дата заняття челенджу: старт учасника + (номер дня − 1), YYYY-MM-DD без зсуву часових поясів
export function itemDate(start, dayNo) {
  const [y, m, d] = String(start).slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d + (dayNo - 1));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export const lastDate = (start, items) => itemDate(start, items.reduce((a, i) => Math.max(a, i.day_no), 1));

// Відмітити заняття челенджу виконаним / зняти відмітку
export async function setChallengeDone(uid, itemId, done) {
  const q = done
    ? supabase.from('challenge_done').upsert({ student_id: uid, item_id: itemId }, { onConflict: 'student_id,item_id' })
    : supabase.from('challenge_done').delete().eq('student_id', uid).eq('item_id', itemId);
  const { error } = await q;
  window.dispatchEvent(new Event('schedule:changed'));
  return error;
}

// Челенджі для учня: активні + моя участь + виконані пункти
export function useChallenges() {
  const { user } = useAuth();
  const uid = user ? user.id : null;
  const [challenges, setChallenges] = useState(null);
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [done, setDone] = useState([]);

  const load = useCallback(async () => {
    if (!uid) return;
    const [c, i, m, d] = await Promise.all([
      supabase.from('challenges').select('*').eq('active', true).order('position').order('created_at'),
      supabase.from('challenge_items').select('*').order('day_no').order('start_time'),
      supabase.from('challenge_members').select('*').eq('student_id', uid),
      supabase.from('challenge_done').select('item_id').eq('student_id', uid)
    ]);
    setChallenges(c.error ? [] : c.data || []);
    setItems(i.error ? [] : i.data || []);
    setMembers(m.error ? [] : m.data || []);
    setDone(d.error ? [] : (d.data || []).map((x) => x.item_id));
  }, [uid]);

  useEffect(() => {
    load();
    window.addEventListener('schedule:changed', load);
    window.addEventListener('pay-changed', load);
    return () => {
      window.removeEventListener('schedule:changed', load);
      window.removeEventListener('pay-changed', load);
    };
  }, [load]);

  return { challenges, items, members, done, reload: load };
}
