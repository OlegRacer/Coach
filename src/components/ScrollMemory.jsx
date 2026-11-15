import { useEffect, useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Запам'ятовує позицію прокрутки сторінок: «Назад» повертає туди, де були, а новий перехід відкриває згори.
const saved = new Map();

export default function ScrollMemory() {
  const loc = useLocation();
  const type = useNavigationType();

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  useLayoutEffect(() => {
    const key = loc.key;
    const y = type === 'POP' ? saved.get(key) || 0 : 0;
    window.scrollTo(0, y);
    // контент може дозавантажитись, тому повторюємо кілька разів
    const timers = y ? [60, 200, 500].map((ms) => setTimeout(() => window.scrollTo(0, y), ms)) : [];
    return () => {
      timers.forEach(clearTimeout);
      saved.set(key, window.scrollY);
    };
  }, [loc.key, type]);

  return null;
}
