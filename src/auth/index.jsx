import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { avatarUrl } from '../lib/image.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  // Якщо вхід провалився на боці Supabase/провайдера, помилка приходить в адресі повернення: показуємо її текстом.
  const [error, setError] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const h = new URLSearchParams(window.location.hash.replace(/^#\/?/, '').replace(/^\?/, ''));
      const m = q.get('error_description') || h.get('error_description') || q.get('error') || h.get('error');
      return m ? decodeURIComponent(m.replace(/\+/g, ' ')) : '';
    } catch {
      return '';
    }
  });
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.has('error') || u.searchParams.has('error_description')) {
        ['error', 'error_code', 'error_description'].forEach((k) => u.searchParams.delete(k));
        window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [details, setDetails] = useState(null);
  const [access, setAccess] = useState({});
  const [exAccess, setExAccess] = useState({});
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('ob-dismissed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) {
          setSession(data.session);
          setReady(true);
        }
      })
      .catch(() => alive && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session && session.user ? session.user.id : null;

  // Профіль з бази (роль, ім'я). Без інтернету лишається ім'я з самого входу.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (alive) setProfile(data);
        if (data && data.role) {
          try {
            localStorage.setItem('role:' + userId, data.role);
          } catch {
            /* ignore */
          }
        }
        await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);
      } catch {
        /* офлайн: не критично */
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // Анкета учня. Якщо запит не вдався (офлайн), анкету не нав'язуємо.
  const refreshDetails = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error: e } = await supabase.from('student_details').select('*').eq('student_id', userId).maybeSingle();
      if (e) return;
      setDetails(data || null);
      setDetailsLoaded(true);
    } catch {
      /* офлайн */
    }
  }, [userId]);

  useEffect(() => {
    setDetails(null);
    setDetailsLoaded(false);
    if (userId) refreshDetails();
  }, [userId, refreshDetails]);

  // Доступ до розділів: { fitness: '2026-12-01T…', … }. Копія лежить у телефоні, щоб працювало офлайн.
  const refreshAccess = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error: e } = await supabase.from('section_access').select('section, expires_at').eq('student_id', userId);
      if (e) throw e;
      const map = Object.fromEntries((data || []).map((r) => [r.section, r.expires_at]));
      setAccess(map);
      try {
        localStorage.setItem('access:' + userId, JSON.stringify(map));
      } catch {
        /* ignore */
      }
      // Доступ до окремих вправ (пакети оплати). Якщо таблиці ще нема, просто порожньо.
      const ex = await supabase.from('exercise_access').select('exercise_id, expires_at').eq('student_id', userId);
      const exMap = ex.error ? {} : Object.fromEntries((ex.data || []).map((r) => [r.exercise_id, r.expires_at]));
      setExAccess(exMap);
      try {
        localStorage.setItem('exaccess:' + userId, JSON.stringify(exMap));
      } catch {
        /* ignore */
      }
    } catch {
      try {
        const cached = JSON.parse(localStorage.getItem('access:' + userId) || '{}');
        setAccess((cur) => (Object.keys(cur).length ? cur : cached));
        const exCached = JSON.parse(localStorage.getItem('exaccess:' + userId) || '{}');
        setExAccess((cur) => (Object.keys(cur).length ? cur : exCached));
      } catch {
        /* ignore */
      }
    } finally {
      setAccessLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    setAccess({});
    setExAccess({});
    setAccessLoaded(false);
    if (!userId) return undefined;
    refreshAccess();
    const onVisible = () => document.visibilityState === 'visible' && refreshAccess();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, refreshAccess]);

  const dismissOnboarding = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem('ob-dismissed', '1');
    } catch {
      /* ignore */
    }
  }, []);

  const signInGoogle = useCallback(async () => {
    setError('');
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (e) setError(e.message);
  }, []);

  // LINE: власний OIDC-провайдер у Supabase з ідентифікатором custom:line (див. README, розділ «Вхід через LINE»).
  const signInLine = useCallback(async () => {
    setError('');
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'custom:line',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (e) setError(e.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setDetails(null);
    setAccess({});
    try {
      sessionStorage.removeItem('ob-dismissed');
    } catch {
      /* ignore */
    }
    setDismissed(false);
  }, []);

  const value = useMemo(() => {
    const meta = (session && session.user && session.user.user_metadata) || {};
    const email = (session && session.user && session.user.email) || '';
    const formName =
      details && details.completed_at ? [details.first_name, details.last_name].filter(Boolean).join(' ') : '';
    const user = session
      ? {
          id: userId,
          email,
          name: formName || (profile && profile.full_name) || meta.full_name || meta.name || email.split('@')[0] || '',
          avatar: (details && details.photo_path ? avatarUrl(details.photo_path) : '') || (profile && profile.avatar_url) || meta.avatar_url || meta.picture || ''
        }
      : null;
    let cachedRole = '';
    try {
      cachedRole = (userId && localStorage.getItem('role:' + userId)) || '';
    } catch {
      /* ignore */
    }
    const isAdmin = (profile ? profile.role : cachedRole) === 'admin';
    const hasAccess = (section) => {
      if (isAdmin) return true;
      const exp = access[section];
      return !!exp && new Date(exp).getTime() > Date.now();
    };
    const hasExercise = (id) => {
      if (isAdmin) return true;
      const exp = exAccess[id];
      return !!exp && new Date(exp).getTime() > Date.now();
    };
    const needsOnboarding = !!user && !!profile && !isAdmin && detailsLoaded && !(details && details.completed_at) && !dismissed;
    return {
      ready, user, profile, isAdmin, signInGoogle, signInLine, signOut, error,
      details, refreshDetails, needsOnboarding, dismissOnboarding,
      access, accessLoaded, hasAccess, hasExercise, exAccess, refreshAccess
    };
  }, [access, exAccess, accessLoaded, refreshAccess, session, profile, ready, userId, signInGoogle, signInLine, signOut, error, details, detailsLoaded, dismissed, refreshDetails, dismissOnboarding]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
