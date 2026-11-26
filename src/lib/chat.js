import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.js';
import { useAuth } from '../auth/index.jsx';

const PAGE = 300;

// Підписка на зміни таблиці чату: нові повідомлення приходять без оновлення сторінки.
// Запасний варіант: перечитування за таймером і при поверненні у вкладку.
function useLive(filter, onChange, everyMs) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const name = 'chat:' + (filter || 'all') + ':' + Math.random().toString(36).slice(2, 7);
    const opts = { event: '*', schema: 'public', table: 'chat_messages' };
    if (filter) opts.filter = filter;
    const ch = supabase.channel(name).on('postgres_changes', opts, () => cb.current()).subscribe();
    const tick = setInterval(() => document.visibilityState === 'visible' && cb.current(), everyMs);
    const vis = () => document.visibilityState === 'visible' && cb.current();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('online', vis);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('online', vis);
      supabase.removeChannel(ch);
    };
  }, [filter, everyMs]);
}

// Розмова учня: повідомлення, надсилання, редагування, видалення, закріплення, мут.
export function useThread(studentId) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!studentId) return;
    const [m, mu] = await Promise.all([
      supabase.from('chat_messages').select('*').eq('student_id', studentId).order('created_at', { ascending: false }).limit(PAGE),
      supabase.from('chat_mutes').select('student_id').eq('student_id', studentId).maybeSingle()
    ]);
    if (!m.error) setMessages((m.data || []).slice().reverse());
    setMuted(!!mu.data);
    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);
  useLive(studentId ? `student_id=eq.${studentId}` : null, load, 15000);

  // Прочитано: усе чуже, що зараз на екрані
  const unreadMine = messages.some((m) => !m.read_at && m.sender_id !== (user && user.id));
  useEffect(() => {
    if (!studentId || !unreadMine || document.visibilityState !== 'visible') return;
    supabase.rpc('chat_mark_read', { p_student: studentId }).then(() => window.dispatchEvent(new Event('chat:read')));
  }, [studentId, unreadMine]);

  const run = async (p) => {
    setError('');
    const { error: e } = await p;
    if (e) setError(e.message);
    await load();
    window.dispatchEvent(new Event('chat:read'));
    return !e;
  };
  return {
    messages,
    loading,
    muted,
    error,
    send: (text) => run(supabase.from('chat_messages').insert({ student_id: studentId, sender_id: user.id, body: text.trim() })),
    edit: (id, text) => run(supabase.rpc('chat_edit', { p_id: id, p_body: text.trim() })),
    remove: (id) => run(supabase.rpc('chat_delete', { p_id: id })),
    pin: (id, pin) => run(supabase.rpc('chat_pin', { p_id: id, p_pin: pin })),
    setMute: (v) => run(supabase.rpc('chat_mute', { p_student: studentId, p_mute: v })),
    clear: () => run(supabase.rpc('chat_clear', { p_student: studentId }))
  };
}

// Кількість непрочитаних (учню від тренера, тренеру від усіх) для значків.
export function useChatUnread() {
  const { user } = useAuth();
  const [n, setN] = useState(0);
  const load = useCallback(async () => {
    if (!user) return setN(0);
    const { data, error } = await supabase.rpc('chat_unread');
    if (!error && typeof data === 'number') setN(data);
  }, [user]);
  useEffect(() => {
    load();
    window.addEventListener('chat:read', load);
    return () => window.removeEventListener('chat:read', load);
  }, [load]);
  useLive(null, load, 60000);
  return n;
}

// Список розмов для тренера.
export function useThreads() {
  const [rows, setRows] = useState(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('chat_threads');
    if (!error) setRows(data || []);
  }, []);
  useEffect(() => {
    load();
    window.addEventListener('chat:read', load);
    return () => window.removeEventListener('chat:read', load);
  }, [load]);
  useLive(null, load, 20000);
  return { rows, reload: load };
}

// Які пуші приходять тренеру: { chat, payments } (true за замовчуванням).
export function useAdminPushPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({});
  useEffect(() => {
    if (!user) return;
    supabase.from('admin_push_prefs').select('prefs').eq('user_id', user.id).maybeSingle().then(({ data }) => setPrefs((data && data.prefs) || {}));
  }, [user]);
  const set = async (key, on) => {
    const next = { ...prefs, [key]: on };
    setPrefs(next);
    await supabase.from('admin_push_prefs').upsert({ user_id: user.id, prefs: next });
  };
  return { prefs, set };
}
