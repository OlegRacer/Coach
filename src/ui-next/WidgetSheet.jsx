import { useEffect } from 'react';
import { useEditing } from '../lib/widgets.js';
import { useI18n } from '../i18n/index.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../auth/index.jsx';
import useAddContent from '../admin/useAddContent.js';

// Меню кнопки «+»: додати тренування або (на головній) редагувати віджети.
export default function WidgetSheet({ open, onClose, onAddWorkout, canEdit }) {
  const { t } = useI18n();
  const [, setEditing] = useEditing();
  const { isAdmin } = useAuth();
  const add = useAddContent('');
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={'sheet-root' + (open ? ' open' : '')} aria-hidden={!open}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('aw.add')}>
        <div className="sheet-head"><span className="sheet-grab" aria-hidden="true" /></div>
        <div className="sheet-body" style={{ gap: 10 }}>
          <button type="button" className="btn-primary" onClick={() => { onClose(); onAddWorkout(); }}>
            <Icon name="plus" size={18} /> {t('aw.add')}
          </button>
          {isAdmin && canEdit && (
            <button type="button" className="btn-ghost" style={{ minHeight: 52 }} disabled={add.busy} onClick={() => { onClose(); add.addSub(); }}>
              {t('content.addSection')}
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn-ghost" style={{ minHeight: 52 }} onClick={() => { onClose(); setEditing(true); }}>
              {t('wd.edit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
