import { useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

export const GOALS = ['lose_weight', 'muscle', 'mobility', 'recovery', 'maintain'];
export const MESSENGERS = [
  { id: 'line', label: 'LINE' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' }
];
const STEPS = [
  { key: 'name', icon: 'user' },
  { key: 'contact', icon: 'chat' },
  { key: 'goals', icon: 'target' },
  { key: 'limits', icon: 'heart' },
  { key: 'consent', icon: 'check' }
];

// Анкета при першому вході: 5 кроків. Усе необов'язкове, крім згоди на кроці 5.
export default function Onboarding({ onClose }) {
  const { t } = useI18n();
  const { user, details, refreshDetails } = useAuth();
  const d = details || {};
  const [step, setStep] = useState(0);
  const [first, setFirst] = useState(d.first_name || '');
  const [last, setLast] = useState(d.last_name || '');
  const [messenger, setMessenger] = useState(d.contact_messenger || '');
  const [handle, setHandle] = useState(d.contact_handle || '');
  const [goals, setGoals] = useState(d.goals || []);
  const [limits, setLimits] = useState(d.limitations || '');
  const [consent, setConsent] = useState(!!d.consent_at);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [armed, setArmed] = useState(false);

  const last_ = step === STEPS.length - 1;
  const cur = STEPS[step].key;
  const toggleGoal = (g) => setGoals((x) => (x.includes(g) ? x.filter((i) => i !== g) : [...x, g]));
  const clean = (v) => (v.trim() ? v.trim() : null);

  const save = async () => {
    if (!consent) {
      setErr(t('ob.consent.required'));
      return;
    }
    setBusy(true);
    setErr('');
    const now = new Date().toISOString();
    const { error } = await supabase.from('student_details').upsert({
      student_id: user.id,
      first_name: clean(first),
      last_name: clean(last),
      contact_messenger: messenger && clean(handle) ? messenger : null,
      contact_handle: messenger ? clean(handle) : null,
      goals,
      limitations: clean(limits),
      consent_at: d.consent_at || now,
      completed_at: now,
      updated_at: now
    });
    setBusy(false);
    if (error) {
      setErr(t('ob.saveError'));
      return;
    }
    await refreshDetails();
    onClose();
  };

  const remove = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('student_details').delete().eq('student_id', user.id);
    setBusy(false);
    if (error) {
      setErr(t('ob.saveError'));
      return;
    }
    await refreshDetails();
    onClose();
  };

  return createPortal(
    <div className="ob-root" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="ob">
        <div className="ob-top">
          {step > 0 ? (
            <button type="button" className="back" onClick={() => setStep(step - 1)} aria-label={t('ob.back')}>
              <Icon name="back" size={22} />
            </button>
          ) : (
            <span className="back-spacer" />
          )}
          <div className="ob-dots" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s.key} className={'ob-dot' + (i <= step ? ' on' : '')} />
            ))}
          </div>
          <button type="button" className="ob-later" onClick={onClose}>
            {t('ob.later')}
          </button>
        </div>

        <div className="ob-body">
          <span className="ob-icon">
            <Icon name={STEPS[step].icon} size={30} />
          </span>
          <h1 id="ob-title" className="title">{t(`ob.${cur}.title`)}</h1>
          <p className="body">{t(`ob.${cur}.sub`)}</p>

          {cur === 'name' && (
            <div className="stack">
              <input className="field" value={first} maxLength={80} onChange={(e) => setFirst(e.target.value)} placeholder={t('ob.firstName')} autoComplete="given-name" />
              <input className="field" value={last} maxLength={80} onChange={(e) => setLast(e.target.value)} placeholder={t('ob.lastName')} autoComplete="family-name" />
            </div>
          )}

          {cur === 'contact' && (
            <div className="stack">
              <div className="chips">
                {MESSENGERS.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={'chip' + (messenger === m.id ? ' active' : '')}
                    aria-pressed={messenger === m.id}
                    onClick={() => setMessenger(messenger === m.id ? '' : m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {messenger && (
                <input className="field" value={handle} maxLength={100} onChange={(e) => setHandle(e.target.value)} placeholder={t('ob.contact.handle')} autoCapitalize="none" autoCorrect="off" />
              )}
            </div>
          )}

          {cur === 'goals' && (
            <div className="chips">
              {GOALS.map((g) => (
                <button type="button" key={g} className={'chip' + (goals.includes(g) ? ' active' : '')} aria-pressed={goals.includes(g)} onClick={() => toggleGoal(g)}>
                  {t(`ob.goal.${g}`)}
                </button>
              ))}
            </div>
          )}

          {cur === 'limits' && (
            <div className="stack">
              <textarea className="field" rows={5} maxLength={2000} value={limits} onChange={(e) => setLimits(e.target.value)} placeholder={t('ob.limits.placeholder')} />
              <p className="small muted">{t('ob.limits.note')}</p>
            </div>
          )}

          {cur === 'consent' && (
            <div className="stack">
              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>{t('ob.consent.text')}</span>
              </label>
              {details && details.completed_at && (
                <button type="button" className="btn-ghost danger" onClick={remove} disabled={busy}>
                  {armed ? t('ob.deleteConfirm') : t('ob.delete')}
                </button>
              )}
            </div>
          )}
          {err && <p className="small err" role="alert">{err}</p>}
        </div>

        <div className="ob-foot">
          {last_ ? (
            <button type="button" className="btn-primary" onClick={save} disabled={busy || !consent}>
              {busy ? t('ob.saving') : t('ob.finish')}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setStep(step + 1)}>
              {t('ob.next')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
