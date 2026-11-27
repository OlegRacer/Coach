import { lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/index.jsx';
import { supabase } from '../lib/supabase.js';
import { ADMIN_STEPS, STUDENT_STEPS } from './steps.js';

const Overlay = lazy(() => import('./TourOverlay.jsx'));

// Гід по додатку: один раз автоматично після анкети, далі за кнопкою «Як користуватися» у профілі.
export function startTour() {
  window.dispatchEvent(new Event('tour:start'));
}

export default function Tour() {
  const { user, isAdmin, ready, needsOnboarding } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const key = isAdmin ? 'tour-admin' : 'tour-student';

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener('tour:start', on);
    return () => window.removeEventListener('tour:start', on);
  }, []);

  // автозапуск лише раз на акаунт (і на пристрої, і в акаунті)
  useEffect(() => {
    if (!ready || !user || needsOnboarding || open) return undefined;
    if (pathname.startsWith('/admin') || pathname.startsWith('/line-callback')) return undefined;
    let seen = false;
    try {
      seen = !!localStorage.getItem(key);
    } catch {
      /* ignore */
    }
    if (seen) return undefined;
    let dead = false;
    let timer;
    supabase.auth.getSession().then(({ data }) => {
      const m = data && data.session && data.session.user && data.session.user.user_metadata;
      if (m && m[key.replace('-', '_')]) {
        try {
          localStorage.setItem(key, '1');
        } catch {
          /* ignore */
        }
        return;
      }
      if (!dead) timer = setTimeout(() => setOpen(true), 1500);
    });
    return () => {
      dead = true;
      clearTimeout(timer);
    };
  }, [ready, user, needsOnboarding, open, pathname, key]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
    supabase.auth.updateUser({ data: { [key.replace('-', '_')]: true } }).catch(() => {});
  };

  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Overlay steps={isAdmin ? ADMIN_STEPS : STUDENT_STEPS} onClose={close} />
    </Suspense>
  );
}
