import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { SUPABASE_HOST } from '../lib/supabase.js';
import { useI18n } from '../i18n/index.jsx';

// Пояснення перед переходом на Google: на екрані Google замість назви застосунку видно адресу сервера.
export default function SignInNotice({ onContinue, onCancel }) {
  const { t } = useI18n();
  return createPortal(
    <div className="ob-root" role="dialog" aria-modal="true" aria-labelledby="si-title">
      <div className="ob">
        <div className="ob-top">
          <button type="button" className="back" onClick={onCancel} aria-label={t('signin.cancel')}>
            <Icon name="back" size={22} />
          </button>
          <span className="ob-dots" />
          <span className="back-spacer" />
        </div>
        <div className="ob-body">
          <span className="ob-icon">
            <Icon name="check" size={30} />
          </span>
          <h1 id="si-title" className="title">{t('signin.title')}</h1>
          <p className="body">{t('signin.text')}</p>
          <p className="host-chip">{SUPABASE_HOST}</p>
          <p className="body">{t('signin.beta')}</p>
        </div>
        <div className="ob-foot stack">
          <button type="button" className="btn-primary" onClick={onContinue}>
            {t('signin.continue')}
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            {t('signin.cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
