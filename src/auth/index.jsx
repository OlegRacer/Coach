import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(null);
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setDetails(null);
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
    const user = session
      ? {
          id: userId,
          email,
          name: (profile && profile.full_name) || meta.full_name || meta.name || email.split('@')[0] || '',
          avatar: (profile && profile.avatar_url) || meta.avatar_url || meta.picture || ''
        }
      : null;
    const isAdmin = !!profile && profile.role === 'admin';
    const needsOnboarding = !!user && !!profile && !isAdmin && detailsLoaded && !(details && details.completed_at) && !dismissed;
    return {
      ready, user, profile, isAdmin, signInGoogle, signOut, error,
      details, refreshDetails, needsOnboarding, dismissOnboarding
    };
  }, [session, profile, ready, userId, signInGoogle, signOut, error, details, detailsLoaded, dismissed, refreshDetails, dismissOnboarding]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
