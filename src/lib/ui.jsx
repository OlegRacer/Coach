import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

// Версія інтерфейсу: 'classic' (поточний) або 'next' (новий, у розробці).
// Перемикач у профілі; запасний шлях: відкрити додаток з ?ui=next або ?ui=classic.
// Поки новий інтерфейс не готовий, перемикач бачить лише адмін. Щоб відкрити всім: SWITCH_FOR_ALL = true.
export const SWITCH_FOR_ALL = false;
const KEY = 'ui:version';
const VALID = ['classic', 'next'];

const read = () => {
  try {
    const q = new URLSearchParams(window.location.search).get('ui');
    if (VALID.includes(q)) {
      localStorage.setItem(KEY, q);
      // прибрати параметр з адреси, щоб після перемикання він не повертав вибір назад
      const u = new URL(window.location.href);
      u.searchParams.delete('ui');
      window.history.replaceState(window.history.state, '', u.toString());
      return q;
    }
    const v = localStorage.getItem(KEY);
    return VALID.includes(v) ? v : 'classic';
  } catch {
    return 'classic';
  }
};

const Ctx = createContext({ ui: 'classic', setUi: () => {} });

export function UiProvider({ children }) {
  const [ui, setState] = useState(read);
  const setUi = useCallback((v) => {
    if (!VALID.includes(v)) return;
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* без сховища перемикання діє до перезавантаження */
    }
    setState(v);
    window.scrollTo(0, 0);
  }, []);
  // Тема оформлення на <html>: classic = Material 3 (Android), next = iOS Liquid Glass
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.dataset.ui = ui;
    const meta = document.querySelector('meta[name="theme-color"]');
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => meta && meta.setAttribute('content', ui === 'next' ? (mq.matches ? '#f2f2f7' : '#0d0e11') : mq.matches ? '#fafaee' : '#12140e');
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [ui]);
  const value = useMemo(() => ({ ui, setUi }), [ui, setUi]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useUi = () => useContext(Ctx);
