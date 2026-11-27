import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { avatarUrl } from '../lib/image.js';

const AuthContext = createContext(null);

// Адреса сторінки-повернення з LINE (має бути вписана в Callback URL каналу LINE).
function lineRedirect() {
  return new URL('line-callback.html', window.location.href.split('#')[0].split('?')[0]).toString();
}
const lineBusy = { v: false };

// Текст помилки Edge Function (invoke кидає загальне повідомлення, а справжній текст лежить у відповіді).
async function fnError(e, data) {
  if (data && data.error) return data.error;
  try {
    if (e && e.context && e.context.json) {
      const j = await e.context.json();
      if (j && j.error) return j.error;
    }
  } catch {
    /* ignore */
  }
  return (e && e.message) || 'LINE: помилка входу';
}

const AUTH_KEY = 'sb-qbgeogmupdigvmywgdoi-auth-token';
function storedSession() {
  try {
    const v = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (v && v.user && v.user.id && v.access_token) return v;
  } catch {
    /* немає збереженої сесії */
  }
  return null;
}
function cachedMap(prefix) {
  try {
    const s = storedSession();
    return s ? JSON.parse(localStorage.getItem(prefix + s.user.id) || '{}') || {} : {};
  } catch {
    return {};
  }
}

export function AuthProvider({ children }) {
  // Сесію беремо з локального сховища одразу, щоб перший кадр уже був «свій» (порядок розділів, роль, доступи), без стрибка після підвантаження.
  const [session, setSession] = useState(storedSession);
  const [profile, setProfile] = useState(null);
  const [linkMsg, setLinkMsg] = useState('');
  const [lineHandoff, setLineHandoff] = useState(false);
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
  const [details, setDetails] = useState(() => {
    try {
      const s = storedSession();
      return s ? JSON.parse(localStorage.getItem('details:' + s.user.id)) || null : null;
    } catch {
      return null;
    }
  });
  const [access, setAccess] = useState(() => cachedMap('access:'));
  const [exAccess, setExAccess] = useState(() => cachedMap('exaccess:'));
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
      try {
        localStorage.setItem('details:' + userId, JSON.stringify(data || null));
      } catch {
        /* ignore */
      }
    } catch {
      /* офлайн */
    }
  }, [userId]);

  useEffect(() => {
    setDetailsLoaded(false);
    try {
      setDetails(userId ? JSON.parse(localStorage.getItem('details:' + userId)) || null : null);
    } catch {
      setDetails(null);
    }
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

  // LINE: LINE підписує токени входу з браузера алгоритмом HS256, а Supabase (власні OIDC) приймає тільки ES256,
  // тому вхід іде через нашу Edge Function «line-login» (див. README, розділ «Вхід через LINE»).
  const signInLine = useCallback(async (mode) => {
    setError('');
    const { data, error: e } = await supabase.functions.invoke('line-login', {
      body: { action: 'url', redirect_uri: lineRedirect() }
    });
    if (e || !data || !data.url) {
      setError(await fnError(e, data));
      return;
    }
    try {
      localStorage.setItem('line-state', data.state);
      localStorage.setItem('line-ts', String(Date.now()));
      if (mode === 'link') localStorage.setItem('line-mode', 'link');
      else localStorage.removeItem('line-mode');
    } catch {
      /* ignore */
    }
    window.location.assign(data.url);
  }, []);

  // Завершення входу з кодом LINE (код одноразовий, тому викликаємо лише один раз).
  const finishLine = useCallback(async (code, state, mode) => {
    const { data, error: e } = await supabase.functions.invoke('line-login', {
      body: { action: 'login', mode, code, state, redirect_uri: lineRedirect() }
    });
    if (mode === 'link') {
      if (e || !data || !data.linked) setError(await fnError(e, data));
      else {
        setLinkMsg('line');
        window.dispatchEvent(new Event('logins-changed'));
      }
      return;
    }
    if (e || !data || !data.token_hash) {
      setError(await fnError(e, data));
      return;
    }
    const { error: ve } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' });
    if (ve) setError(ve.message);
  }, []);

  // Повернення з LINE: сторінка line-callback.html перекидає сюди як #/line-callback?code=…&state=…
  // Якщо це інший браузер (iPhone: LINE відкрив Safari, а додаток встановлений окремо), стану тут немає:
  // тоді лише передаємо код додатку через сервер, а додаток сам завершує вхід.
  useEffect(() => {
    const m = window.location.hash.match(/^#\/line-callback\?(.*)$/);
    if (!m || lineBusy.v) return;
    lineBusy.v = true;
    const q = new URLSearchParams(m[1]);
    window.history.replaceState(null, '', window.location.pathname + '#/');
    (async () => {
      const bad = q.get('error_description') || q.get('error');
      if (bad || !q.get('code')) {
        setError(bad || 'LINE: порожня відповідь');
        return;
      }
      let saved = '';
      let mode = '';
      try {
        saved = localStorage.getItem('line-state') || '';
        mode = localStorage.getItem('line-mode') || '';
      } catch {
        /* ignore */
      }
      if (!saved) {
        const { data, error: e } = await supabase.functions.invoke('line-login', {
          body: { action: 'stash', code: q.get('code'), state: q.get('state'), redirect_uri: lineRedirect() }
        });
        if (e || !data || !data.ok) setError(await fnError(e, data));
        else setLineHandoff(true);
        return;
      }
      try {
        localStorage.removeItem('line-state');
        localStorage.removeItem('line-mode');
      } catch {
        /* ignore */
      }
      if (saved !== q.get('state')) {
        setError('LINE: state не збігається, спробуйте ще раз');
        return;
      }
      await finishLine(q.get('code'), q.get('state'), mode);
    })();
  }, [finishLine]);

  // Додаток чекає на код, який браузер залишив на сервері (див. вище). Перевіряємо при поверненні у додаток і кожні 2 с.
  useEffect(() => {
    let stop = false;
    let busy = false;
    const tick = async () => {
      let st = '';
      try {
        st = localStorage.getItem('line-state') || '';
      } catch {
        /* ignore */
      }
      try {
        if (st && Date.now() - Number(localStorage.getItem('line-ts') || 0) > 14 * 60 * 1000) {
          localStorage.removeItem('line-state');
          localStorage.removeItem('line-mode');
          st = '';
        }
      } catch {
        /* ignore */
      }
      if (!st || busy || stop || lineBusy.v) return;
      busy = true;
      try {
        const { data } = await supabase.functions.invoke('line-login', {
          body: { action: 'poll', state: st, redirect_uri: lineRedirect() }
        });
        if (data && data.code && !stop) {
          let mode = '';
          try {
            mode = localStorage.getItem('line-mode') || '';
            localStorage.removeItem('line-state');
            localStorage.removeItem('line-mode');
          } catch {
            /* ignore */
          }
          lineBusy.v = true;
          await finishLine(data.code, st, mode);
          lineBusy.v = false;
        }
      } catch {
        /* ignore */
      }
      busy = false;
    };
    const id = setInterval(tick, 2000);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', tick);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', tick);
    };
  }, [finishLine]);

  // Додати Google до акаунта, у який учень уже увійшов (потрібне «Allow manual linking» у Supabase).
  const linkGoogle = useCallback(async () => {
    setError('');
    const { error: e } = await supabase.auth.linkIdentity({
      provider: 'google',
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
      ready, user, profile, isAdmin, signInGoogle, signInLine, linkGoogle, linkMsg, signOut, error,
      details, refreshDetails, needsOnboarding, dismissOnboarding,
      access, accessLoaded, hasAccess, hasExercise, exAccess, refreshAccess
    };
  }, [linkGoogle, linkMsg, access, exAccess, accessLoaded, refreshAccess, session, profile, ready, userId, signInGoogle, signInLine, signOut, error, details, detailsLoaded, dismissed, refreshDetails, dismissOnboarding]);

  if (lineHandoff) {
    const l = (navigator.language || 'en').toLowerCase();
    const msg = l.startsWith('uk')
      ? ['Готово!', 'Поверніться у додаток — вхід завершиться автоматично. Це вікно можна закрити.']
      : l.startsWith('zh')
        ? ['完成！', '請回到應用程式，登入會自動完成。可以關閉此視窗。']
        : ['Done!', 'Go back to the app — sign-in will finish automatically. You can close this window.'];
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, textAlign: 'center', background: '#0e1016', color: '#e6e9ef', font: '16px system-ui,sans-serif' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{msg[0]}</div>
        <div style={{ color: '#9aa3b2', maxWidth: 320 }}>{msg[1]}</div>
      </div>
    );
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
