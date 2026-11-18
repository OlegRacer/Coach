import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

// Версія інтерфейсу: 'classic' (поточний) або 'next' (новий, у розробці).
// Перемикач у профілі; запасний шлях: відкрити додаток з ?ui=next або ?ui=classic.
// Перемикач бачать усі учні. Назви тем: classic = One UI, next = Liquid Glass.
export const SWITCH_FOR_ALL = true;
const KEY = 'ui:version';
const VALID = ['classic', 'next'];

// Тема за замовчуванням залежить від системи: Apple (iPhone, iPad, Mac) — Liquid Glass, Android та інші — One UI.
// Діє, поки учень сам не вибрав тему (вибір зберігається і має перевагу).
const defaultUi = () => {
  try {
    const ua = navigator.userAgent || '';
    const apple = /iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return apple && !/Android/i.test(ua) ? 'next' : 'classic';
  } catch {
    return 'classic';
  }
};

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
    return VALID.includes(v) ? v : defaultUi();
  } catch {
    return defaultUi();
  }
};

const TKEY = 'ui:theme';
const THEMES = ['auto', 'light', 'dark'];
const readTheme = () => {
  try {
    const v = localStorage.getItem(TKEY);
    return THEMES.includes(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
};

const Ctx = createContext({ ui: 'classic', setUi: () => {}, theme: 'auto', setTheme: () => {}, light: false });

export function UiProvider({ children }) {
  const [ui, setState] = useState(read);
  const [theme, setThemeState] = useState(readTheme);
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'light');
  const setTheme = useCallback((v) => {
    if (!THEMES.includes(v)) return;
    try {
      localStorage.setItem(TKEY, v);
    } catch {
      /* ignore */
    }
    setThemeState(v);
  }, []);
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
  // Скін (One UI / Liquid Glass) і світла/темна тема на <html>; «авто» стежить за системою
  useLayoutEffect(() => {
    const el = document.documentElement;
    el.dataset.ui = ui;
    const meta = document.querySelector('meta[name="theme-color"]');
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const sync = () => {
      const light = theme === 'light' || (theme === 'auto' && mq.matches);
      el.dataset.theme = light ? 'light' : 'dark';
      setLight(light);
      if (meta) meta.setAttribute('content', ui === 'next' ? (light ? '#f2f2f7' : '#0d0e11') : light ? '#f2f2f4' : '#000000');
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [ui, theme]);
  const value = useMemo(() => ({ ui, setUi, theme, setTheme, light }), [ui, setUi, theme, setTheme, light]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useUi = () => useContext(Ctx);
