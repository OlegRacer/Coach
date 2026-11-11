import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import useOnline from '../lib/useOnline.js';

// Поки у учня є оплата «очікує», додаток сам перевіряє її статус (миттєво через Realtime, запасно кожні 6 с).
// Коли тренер підтвердив: оновлюємо доступи (курс відкривається без перезавантаження) і показуємо плашку.
// Інші екрани (Оплата) слухають подію 'pay-changed', щоб оновити свій список.
export default function PayWatcher() {
  const { t } = useI18n();
  const { user, isAdmin, refreshAccess } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const [done, setDone] = useState(null); // 'approved' | 'rejected'
  const known = useRef(new Map()); // id -> status
  const uid = user && !isAdmin ? user.id : '';

  const check = useCallback(async () => {
    if (!uid) return;
    const { data, error } = await supabase.from('payment_requests').select('id, status').eq('student_id', uid).order('created_at', { ascending: false }).limit(20);
    if (error || !data) return;
    let changed = false;
    let result = null;
    data.forEach((r) => {
      const was = known.current.get(r.id);
      if (was === 'pending' && r.status !== 'pending') {
        changed = true;
        result = r.status === 'approved' ? 'approved' : result || 'rejected';
      }
      known.current.set(r.id, r.status);
    });
    if (changed) {
      if (result === 'approved') await refreshAccess();
      setDone(result);
      window.dispatchEvent(new Event('pay-changed'));
    }
    return data.some((r) => r.status === 'pending');
  }, [uid, refreshAccess]);

  const [pending, setPending] = useState(false);
  const recheck = useCallback(async () => setPending(!!(await check())), [check]);

  useEffect(() => {
    known.current = new Map();
    if (uid && online) recheck();
  }, [uid, online, recheck]);
  useEffect(() => {
    window.addEventListener('pay-sent', recheck);
    const vis = () => document.visibilityState === 'visible' && recheck();
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pay-sent', recheck);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [recheck]);

  // Поки є очікування: Realtime + опитування.
  useEffect(() => {
    if (!uid || !online || !pending) return undefined;
    const id = setInterval(() => document.visibilityState === 'visible' && recheck(), 6000);
    let ch = null;
    try {
      ch = supabase
        .channel('pay-' + uid)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payment_requests', filter: `student_id=eq.${uid}` }, () => recheck())
        .subscribe();
    } catch {
      /* Realtime не обов'язковий: є опитування */
    }
    return () => {
      clearInterval(id);
      if (ch) supabase.removeChannel(ch);
    };
  }, [uid, online, pending, recheck]);

  if (!done) return null;
  return (
    <div className="pay-toast card" role="status">
      <span>{done === 'approved' ? t('pay.toast.approved') : t('pay.toast.rejected')}</span>
      <div className="row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setDone(null);
            navigate(done === 'approved' ? '/' : '/plans');
          }}
        >
          {done === 'approved' ? t('pay.toast.open') : t('pay.toast.details')}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setDone(null)}>{t('pay.toast.close')}</button>
      </div>
    </div>
  );
}
