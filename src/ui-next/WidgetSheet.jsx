import { useEffect } from 'react';
import { useContent, useL } from '../lib/content.jsx';
import { useWidgets } from '../lib/widgets.js';
import { useI18n } from '../i18n/index.jsx';
import Icon from '../components/Icon.jsx';

// Шторка «Віджети»: показати або сховати віджети на головній (розклад, кожен розділ).
// onAddWorkout: швидка дія «Додати тренування».
export default function WidgetSheet({ open, onClose, onAddWorkout, showWidgets }) {
  const { t } = useI18n();
  const L = useL();
  const { sections } = useContent();
  const { isHidden, toggle } = useWidgets();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const rows = [{ id: 'schedule', label: t('home.schedule') }, ...sections.map((x) => ({ id: 'sec:' + x.id, label: L(x.title) }))];
  return (
    <div className={'sheet-root' + (open ? ' open' : '')} aria-hidden={!open}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('wd.title')}>
        <div className="sheet-head"><span className="sheet-grab" aria-hidden="true" /></div>
        <div className="sheet-body">
          <button type="button" className="btn-primary" onClick={() => { onClose(); onAddWorkout(); }}>
            <Icon name="plus" size={18} /> {t('aw.add')}
          </button>
          {showWidgets && (
            <>
              <h2 className="h2 wd-title">{t('wd.title')}</h2>
              <p className="muted small">{t('wd.hint')}</p>
              {rows.map((r) => (
                <div key={r.id} className="set-row">
                  <span className="set-label">{r.label}</span>
                  <button type="button" role="switch" aria-checked={!isHidden(r.id)} aria-label={r.label}
                    className={'ios-switch' + (isHidden(r.id) ? '' : ' on')} onClick={() => toggle(r.id)}><span /></button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
