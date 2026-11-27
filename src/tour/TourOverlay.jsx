import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

// Підсвічує елемент (вирізом у темному фоні) і показує картку з текстом та кнопками.
export default function TourOverlay({ steps, onClose }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const [vh, setVh] = useState(window.innerHeight);
  const elRef = useRef(null);
  const step = steps[i];

  // на час гіду нижня панель завжди на місці (не ховається при скролі)
  useEffect(() => {
    document.documentElement.dataset.tour = '1';
    return () => { delete document.documentElement.dataset.tour; };
  }, []);

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el || !el.isConnected) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    setVh(window.innerHeight);
  }, []);

  // перейти на потрібну сторінку й знайти елемент
  useEffect(() => {
    let dead = false;
    elRef.current = null;
    setRect(null);
    if (step.route && pathname !== step.route) navigate(step.route);
    if (!step.sel) return undefined;
    document.documentElement.dataset.bar = 'show';
    let tries = 0;
    const find = () => {
      if (dead) return;
      const el = document.querySelector(step.sel);
      if (el) {
        elRef.current = el;
        if (!el.closest('.tabbar')) el.scrollIntoView({ block: 'center', behavior: 'auto' });
        requestAnimationFrame(measure);
        return;
      }
      tries += 1;
      if (tries < 30) setTimeout(find, 120);
    };
    find();
    return () => { dead = true; };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const on = () => measure();
    window.addEventListener('resize', on);
    window.addEventListener('scroll', on, true);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on, true);
    };
  }, [measure]);

  const last = i === steps.length - 1;
  const pad = 6;
  const below = rect ? rect.y + rect.h + pad + 190 < vh : true;
  const cardStyle = rect
    ? below
      ? { top: Math.min(rect.y + rect.h + pad + 12, vh - 200) }
      : { bottom: Math.max(vh - rect.y + pad + 12, 12) }
    : { top: '50%', transform: 'translateY(-50%)' };

  return (
    <div className="tour" role="dialog" aria-modal="true">
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {rect ? (
        <div className="tour-spot" style={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={cardStyle}>
        <b className="tour-title">{t(`tour.${step.id}.t`)}</b>
        <p className="tour-text">{t(`tour.${step.id}.b`)}</p>
        <div className="tour-row">
          <button type="button" className="tour-skip" onClick={() => onClose(true)}>{t('tour.skip')}</button>
          <span className="tour-dots">{i + 1}/{steps.length}</span>
          {i > 0 && <button type="button" className="btn-ghost btn-small" onClick={() => setI(i - 1)}>{t('tour.back')}</button>}
          <button type="button" className="btn-primary btn-small" onClick={() => (last ? onClose(true) : setI(i + 1))}>{last ? t('tour.done') : t('tour.next')}</button>
        </div>
      </div>
    </div>
  );
}
