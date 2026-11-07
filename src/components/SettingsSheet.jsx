import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import ShareLink from './ShareLink.jsx';
import { useI18n } from '../i18n/index.jsx';

// Нижня панель налаштувань: виїжджає знизу на всю ширину, висота за вмістом.
// Закривається: хрестик, дотик по затемненню, Esc, свайп вниз за верхню частину.
// Нові налаштування додаються як <div className="set-row"> усередині .sheet-body.
export default function SettingsSheet({ open, onClose }) {
  const { t } = useI18n();
  const closeRef = useRef(null);
  const lastFocus = useRef(null);
  const startY = useRef(null);
  const [drag, setDrag] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    lastFocus.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const timer = setTimeout(() => closeRef.current && closeRef.current.focus(), 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (lastFocus.current && lastFocus.current.focus) lastFocus.current.focus();
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
          <div className="profile">
            <span className="avatar" aria-hidden="true">
              <Icon name="user" size={28} />
            </span>
            <div className="profile-text">
              <span id="settings-title" className="muted small">
                {t('profile.title')}
              </span>
              <span className="profile-name">{t('profile.guest')}</span>
            </div>
          </div>
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

        <div className="sheet-body">
          <div className="set-row">
            <span className="set-label">{t('settings.language')}</span>
            <LangSwitcher />
          </div>
          <ShareLink />
        </div>
      </div>
    </div>
  );
}
