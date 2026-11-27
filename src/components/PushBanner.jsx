import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Плашка зверху для пушів. Не зникає, поки сповіщення не відкрито: тап відкриває діалог (або закриває розсилку).
// Зберігається між запусками додатка; пуші, що прийшли, коли додаток був закритий, теж підхоплюються.
// Під час скролу ховається вгору й повертається разом з нижньою панеллю (html[data-bar]).
const KEY = 'push-pending';
function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function pathOf(url) {
  try {
    const h = new URL(url, window.location.href).hash;
    return h && h.startsWith('#/') ? h.slice(1) : '';
  } catch {
    return '';
  }
}
async function closeSystem() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const list = reg ? await reg.getNotifications() : [];
    list.forEach((n) => n.close());
  } catch {
    /* ignore */
  }
}

export default function PushBanner() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [items, setItemsRaw] = useState(load);
  const ref = useRef(items);
  const setItems = useCallback((fn) => {
    const next = typeof fn === 'function' ? fn(ref.current) : fn;
    ref.current = next;
    setItemsRaw(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const add = useCallback((d) => {
    const path = pathOf(d.url);
    if (path && path === window.location.hash.slice(1) && document.visibilityState === 'visible') return;
    setItems((a) => (a.some((x) => x.key === d.key) ? a : [...a.slice(-9), { key: d.key, title: d.title, body: d.body, path }]));
  }, [setItems]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const on = (e) => {
      const d = e.data;
      if (d && d.type === 'push-received') add({ key: 'm' + Date.now() + Math.random(), title: d.title, body: d.body, url: d.url });
    };
    navigator.serviceWorker.addEventListener('message', on);
    // сповіщення, що прийшли, поки додаток був закритий (ще висять у центрі сповіщень)
    const pull = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const list = reg ? await reg.getNotifications() : [];
        list.forEach((n) => add({ key: 'n' + (n.tag || '') + n.body, title: n.title, body: n.body, url: (n.data && n.data.url) || './' }));
      } catch {
        /* ignore */
      }
    };
    pull();
    const vis = () => document.visibilityState === 'visible' && pull();
    document.addEventListener('visibilitychange', vis);
    return () => {
      navigator.serviceWorker.removeEventListener('message', on);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [add]);

  // відкрили потрібний діалог (будь-яким способом): плашки для нього прибираємо
  useEffect(() => {
    if (ref.current.some((x) => x.path && x.path === pathname)) {
      setItems((a) => a.filter((x) => x.path !== pathname));
      closeSystem();
    }
  }, [pathname, setItems]);

  if (!items.length) return null;
  const cur = items[items.length - 1];
  const open = () => {
    setItems((a) => a.filter((x) => x.key !== cur.key));
    if (cur.path) navigate(cur.path);
    closeSystem();
  };
  return (
    <div className="push-banner" role="status">
      <button type="button" className="push-banner-main" onClick={open}>
        <b>{cur.title}</b>
        <span>{cur.body}</span>
      </button>
      {items.length > 1 && <span className="badge-count">{items.length}</span>}
    </div>
  );
}
