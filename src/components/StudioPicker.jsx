import { useI18n } from '../i18n/index.jsx';
import { pickStudio } from '../lib/studios.js';

// Вибір студій, «Інше» (без студії) і класів обраних студій. Спільний для анкети й адмінки.
export default function StudioPicker({ studios, classes, value, onChange }) {
  const { t } = useI18n();
  const toggleClass = (id) =>
    onChange({ ...value, classes: value.classes.includes(id) ? value.classes.filter((x) => x !== id) : [...value.classes, id] });
  return (
    <div className="stack">
      <div className="chips">
        {studios.map((x) => (
          <button type="button" key={x.id} className={'chip' + (value.studios.includes(x.id) ? ' active' : '')} aria-pressed={value.studios.includes(x.id)} onClick={() => onChange(pickStudio(value, x.id, classes))}>
            {x.name}
          </button>
        ))}
        <button type="button" className={'chip' + (value.other ? ' active' : '')} aria-pressed={value.other} onClick={() => onChange(value.other ? { ...value, other: false } : { studios: [], classes: [], other: true })}>
          {t('ob.studio.other')}
        </button>
      </div>
      {value.other && <p className="small muted">{t('ob.studio.otherNote')}</p>}
      {value.studios.map((id) => {
        const st = studios.find((x) => x.id === id);
        const list = classes.filter((c) => c.studio_id === id);
        if (!st) return null;
        return (
          <div key={id} className="stack">
            <b>{st.name}</b>
            {!list.length && <span className="muted small">{t('ob.studio.noClasses')}</span>}
            <div className="chips">
              {list.map((c) => (
                <button type="button" key={c.id} className={'chip chip-sub' + (value.classes.includes(c.id) ? ' active' : '')} aria-pressed={value.classes.includes(c.id)} onClick={() => toggleClass(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
