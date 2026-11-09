import { useState } from 'react';
import { LANGS, useI18n } from '../i18n/index.jsx';

export const newId = (prefix) => prefix + '-' + Math.random().toString(36).slice(2, 8);

// Три поля (uk, en, zh-TW) для тексту, що зберігається як {uk,en,zh-TW}.
export function LangField({ label, value, onChange, multiline, maxLength = 4000 }) {
  const v = value || {};
  return (
    <div className="lang-field">
      {label && <span className="muted small">{label}</span>}
      {LANGS.map((l) => {
        const Tag = multiline ? 'textarea' : 'input';
        return (
          <div key={l.code} className="lang-row">
            <span className="lang-tag">{l.label}</span>
            <Tag
              className="field"
              rows={multiline ? 4 : undefined}
              maxLength={maxLength}
              lang={l.code}
              value={v[l.code] || ''}
              onChange={(e) => onChange({ ...v, [l.code]: e.target.value })}
            />
          </div>
        );
      })}
    </div>
  );
}

// Кнопка з підтвердженням другим натисканням.
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn-danger' }) {
  const [armed, setArmed] = useState(false);
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          setTimeout(() => setArmed(false), 4000);
        } else {
          setArmed(false);
          onConfirm();
        }
      }}
    >
      {armed ? confirmLabel || t('content.sure') : label}
    </button>
  );
}

export const ICONS = ['barbell', 'roller', 'mobility', 'anatomy', 'heart', 'target', 'chat'];
export const COLORS = ['#C6F432', '#FF8A5B', '#8FD3FF', '#C9B8FF', '#FFD166', '#7EE0B5', '#FF8FB1', '#B8C0CC'];
