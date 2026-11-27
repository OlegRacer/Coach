import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

// Плашка зверху, коли пуш приходить під час роботи з додатком. Лишається, поки її не натиснути (відкриває діалог)
// або не закрити хрестиком. Під час скролу ховається вгору (як нижня панель, html[data-bar]) і повертається при скролі вгору.
export default function PushBanner() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const on = (e) => {
      const d = e.data;
      if (!d || d.type !== 'push-received') return;
      let path = '';
      try {
        const h = new URL(d.url).hash;
        if (h && h.startsWith('#/')) path = h.slice(1);
      } catch {
        /* ignore */
      }
      // уже в цьому діалозі: плашка не потрібна
      if (path && path === window.location.hash.slice(1)) return;
      setItems((a) => [...a.slice(-9), { id: Date.now() + Math.random(), title: d.title, body: d.body, path }]);
    };
    navigator.serviceWorker.addEventListener('message', on);
    return () => navigator.serviceWorker.removeEventListener('message', on);
  }, []);
  // перейшли в потрібний діалог самі: прибираємо плашки для нього
  useEffect(() => {
    setItems((a) => (a.some((x) => x.path && x.path === pathname) ? a.filter((x) => x.path !== pathname) : a));
  }, [pathname]);
  if (!items.length) return null;
  const cur = items[items.length - 1];
  const open = () => {
    setItems([]);
    if (cur.path) navigate(cur.path);
  };
  return (
    <div className="push-banner" role="status">
      <button type="button" className="push-banner-main" onClick={open}>
        <b>{cur.title}</b>
        <span>{cur.body}</span>
      </button>
      {items.length > 1 && <span className="badge-count">{items.length}</span>}
      <button type="button" className="push-banner-x" aria-label={t('common.close')} onClick={() => setItems([])}>×</button>
    </div>
  );
}
