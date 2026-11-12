import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { MESSENGERS } from './Onboarding.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Перегляд заповненої анкети. Внизу кнопка «Змінити дані» відкриває майстер із готовими відповідями.
export default function ProfileDetails({ onClose, onEdit }) {
  const { t } = useI18n();
  const { details, user } = useAuth();
  const d = details || {};
  const none = t('ob.none');
  const name = [d.first_name, d.last_name].filter(Boolean).join(' ');
  const msg = MESSENGERS.find((m) => m.id === d.contact_messenger);
  const body = [d.height_cm && `${d.height_cm} cm`, d.weight_kg && `${d.weight_kg} kg`, d.birth_year && `${d.birth_year}`]
    .filter(Boolean)
    .join(' · ');
  const rows = [
    [t('ob.email'), (user && user.email) || ''],
    [t('ob.firstName') + ' / ' + t('ob.lastName'), name],
    [t('ob.contact.label'), msg && d.contact_handle ? `${msg.label} · ${d.contact_handle}` : ''],
    [t('ob.goals.label'), (d.goals || []).map((g) => t(`ob.goal.${g}`)).join(', ')],
    [t('ob.gender.label'), d.gender ? t(`ob.gender.${d.gender}`) : ''],
    [t('ob.body.label'), body],
    [t('ob.limits.label'), d.limitations || '']
  ];

  return createPortal(
    <div className="ob-root" role="dialog" aria-modal="true" aria-labelledby="pd-title">
      <div className="ob">
        <div className="ob-top">
          <button type="button" className="back" onClick={onClose} aria-label={t('ob.back')}>
            <Icon name="back" size={22} />
          </button>
          <span className="ob-dots" />
          <span className="back-spacer" />
        </div>
        <div className="ob-body">
          <h1 id="pd-title" className="title">{t('ob.viewTitle')}</h1>
          <div className="list">
            {rows.map(([label, value]) => (
              <div key={label} className="list-item pd-row">
                <span className="muted small">{label}</span>
                <span className={'pd-val' + (value ? '' : ' muted')}>{value || none}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ob-foot">
          <button type="button" className="btn-primary" onClick={onEdit}>
            {t('ob.change')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
