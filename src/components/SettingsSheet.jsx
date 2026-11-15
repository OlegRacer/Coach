import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import ProfileCard from './ProfileCard.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import ShareLink from './ShareLink.jsx';
import UpdateRow from './UpdateRow.jsx';
import { useI18n } from '../i18n/index.jsx';

// Нижня панель налаштувань: виїжджає знизу на всю ширину, висота за вмістом.
// Закривається: хрестик, дотик по затемненню, Esc, свайп вниз за верхню частину.
// Нові налаштування додаються як <div className="set-row"> усередині .sheet-body.
export default function SettingsSheet({ open, onClose }) {
  const { t } = useI18n();
  const closeRef = useRef(null);
  const sheetRef = useRef(null);
  const lastFocus = useRef(null);
  const startY = useRef(null);
  const [drag, setDrag] = useState(0);

  // Повернулись у налаштування: прокрутка відновлюється до першого показу, без видимого «доскролу»
  useLayoutEffect(() => {
    if (!open || !sheetRef.current) return undefined;
    const el = sheetRef.current;
    let y = 0;
    try {
      y = Number(sessionStorage.getItem('settings:scroll')) || 0;
      sessionStorage.removeItem('settings:scroll');
    } catch {
      /* ігноруємо */
    }
    if (!y) return undefined;
    el.scrollTop = y;
    // Вміст може дорости (профіль, входи): тримаємо позицію, поки він росте, але не довше 1.5 с і не після дотику
    let done = false;
    const stop = () => {
      done = true;
    };
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => !done && (el.scrollTop = y)) : null;
    if (ro && el.firstElementChild) ro.observe(el.querySelector('.sheet-body') || el);
    el.addEventListener('touchstart', stop, { passive: true });
    el.addEventListener('wheel', stop, { passive: true });
    const t = setTimeout(stop, 1500);
    return () => {
      clearTimeout(t);
      if (ro) ro.disconnect();
      el.removeEventListener('touchstart', stop);
      el.removeEventListener('wheel', stop);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const timer = setTimeout(() => closeRef.current && closeRef.current.focus({ preventScroll: true }), 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (lastFocus.current && lastFocus.current.focus) lastFocus.current.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  const onDown = (e) => {
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (startY.current == null) return;
    setDrag(Math.max(0, e.clientY - startY.current));
  };
  const onUp = () => {
    if (startY.current == null) return;
    const shouldClose = drag > 90;
    startY.current = null;
    setDrag(0);
    if (shouldClose) onClose();
  };

  return (
    <div className={'sheet-root' + (open ? ' open' : '')} aria-hidden={!open}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <div
          className="sheet-head"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className="sheet-grab" aria-hidden="true" />
          <button
            ref={closeRef}
            type="button"
            className="sr-only"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {t('settings.close')}
          </button>
        </div>

        <div
          className="sheet-body"
          onClick={(e) => {
            // перехід на іншу сторінку з налаштувань: запам'ятати, щоб «Назад» повернув у налаштування
            const a = e.target.closest && e.target.closest('a[href^="#/"]');
            if (a) {
              try {
                sessionStorage.setItem('settings:return', '1');
                sessionStorage.setItem('settings:scroll', String(sheetRef.current ? sheetRef.current.scrollTop : 0));
              } catch {
                /* ігноруємо */
              }
            }
          }}
        >
          <ProfileCard />
          <div className="set-row">
            <span className="set-label">{t('settings.language')}</span>
            <LangSwitcher />
          </div>
          <ShareLink />
          <UpdateRow />
        </div>
      </div>
    </div>
  );
}
