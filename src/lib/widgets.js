import { useCallback, useEffect, useState } from 'react';

// Віджети головної (новий інтерфейс): які сховані, їхній порядок і режим редагування. Зберігається на пристрої.
// id: 'schedule' або 'sec:<id розділу>'.
const HID = 'ui:widgets:hidden';
const ORD = 'ui:widgets:order';
const readList = (k) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
// Віджети, які за замовчуванням сховані (вмикаються через «Додати віджет»); у списку це запис '+id'
const DEFAULT_OFF = ['schedule:mine'];
const writeList = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* без сховища зміна діє до перезавантаження */
  }
  window.dispatchEvent(new Event('widgets:changed'));
};

// Повний порядок: збережений + нові віджети в кінці
export const orderIds = (all, order) => {
  const known = order.filter((id) => all.includes(id));
  return [...known, ...all.filter((id) => !known.includes(id))];
};

export function useWidgets() {
  const [hidden, setHidden] = useState(() => readList(HID));
  const [order, setOrderState] = useState(() => readList(ORD));
  useEffect(() => {
    const on = () => {
      setHidden(readList(HID));
      setOrderState(readList(ORD));
    };
    window.addEventListener('widgets:changed', on);
    return () => window.removeEventListener('widgets:changed', on);
  }, []);
  const toggle = useCallback((id) => {
    const cur = readList(HID);
    const k = DEFAULT_OFF.includes(id) ? '+' + id : id;
    writeList(HID, cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]);
  }, []);
  const setOrder = useCallback((ids) => writeList(ORD, ids), []);
  return { hidden, order, isHidden: (id) => (DEFAULT_OFF.includes(id) ? !hidden.includes('+' + id) : hidden.includes(id)), toggle, setOrder };
}

// Режим редагування віджетів (спільний для головної та нижньої панелі)
let editing = false;
export function useEditing() {
  const [on, setOn] = useState(editing);
  useEffect(() => {
    const h = () => setOn(editing);
    window.addEventListener('widgets:edit', h);
    return () => window.removeEventListener('widgets:edit', h);
  }, []);
  const set = useCallback((v) => {
    editing = !!v;
    document.documentElement.toggleAttribute('data-editing', editing);
    window.dispatchEvent(new Event('widgets:edit'));
  }, []);
  return [on, set];
}
