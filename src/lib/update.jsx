import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UpdateContext = createContext(null);
const CHECK_EVERY_MS = 30 * 60 * 1000;

// Оновлення застосунку. iPhone не перезавантажує ярлик з екрана сам, тому:
// 1) перевіряємо нову версію кожного разу, коли застосунок знову відкривають, і раз на пів години;
// 2) коли нова версія вже завантажена, показуємо плашку «Оновити» (UpdateBanner);
// 3) у налаштуваннях є кнопка «Перевірити оновлення» (check).
export function UpdateProvider({ children }) {
  const reg = useRef(null);
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      reg.current = registration || null;
    }
  });

  const ping = useCallback(async () => {
    try {
      if (reg.current && navigator.onLine) await reg.current.update();
    } catch {
      /* без інтернету перевірка пропускається */
    }
  }, []);

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && ping();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', ping);
    const timer = setInterval(ping, CHECK_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', ping);
      clearInterval(timer);
    };
  }, [ping]);

  const check = useCallback(async () => {
    setUpToDate(false);
    setChecking(true);
    await ping();
    // дати воркеру хвилину, щоб повідомити про нову версію
    await new Promise((r) => setTimeout(r, 1200));
    setChecking(false);
    setUpToDate(true);
  }, [ping]);

  const apply = useCallback(() => updateServiceWorker(true), [updateServiceWorker]);

  const value = useMemo(
    () => ({ needRefresh, apply, check, checking, upToDate }),
    [needRefresh, apply, check, checking, upToDate]
  );
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdate() {
  return useContext(UpdateContext);
}
