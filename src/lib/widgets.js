import { useCallback, useEffect, useState } from 'react';

// Які віджети приховані на головній (новий інтерфейс). Зберігається на пристрої.
// id: 'schedule' або 'sec:<id розділу>'.
const KEY = 'ui:widgets:hidden';
const read = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export function useWidgets() {
  const [hidden, setHidden] = useState(read);
  useEffect(() => {
    const on = () => setHidden(read());
    window.addEventListener('widgets:changed', on);
    return () => window.removeEventListener('widgets:changed', on);
  }, []);
  const toggle = useCallback((id) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* без сховища зміна діє до перезавантаження */
    }
    setHidden(next);
    window.dispatchEvent(new Event('widgets:changed'));
  }, []);
  return { hidden, isHidden: (id) => hidden.includes(id), toggle };
}
