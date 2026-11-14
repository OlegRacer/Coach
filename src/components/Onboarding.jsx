import { useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { avatarUrl, squarePhoto } from '../lib/image.js';
import { useI18n } from '../i18n/index.jsx';
import { useStudioData, saveStudioChoice } from '../lib/studios.js';
import StudioPicker from './StudioPicker.jsx';

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
  { key: 'studio', icon: 'barbell' },
  { key: 'goals', icon: 'target' },
  { key: 'body', icon: 'anatomy' },
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
  const [height, setHeight] = useState(d.height_cm != null ? String(d.height_cm) : '');
  const [weight, setWeight] = useState(d.weight_kg != null ? String(d.weight_kg) : '');
  const [year, setYear] = useState(d.birth_year != null ? String(d.birth_year) : '');
  const [gender, setGender] = useState(d.gender || '');
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPrev, setPhotoPrev] = useState('');
  const [photoGone, setPhotoGone] = useState(false);
  const [limits, setLimits] = useState(d.limitations || '');
  const [consent, setConsent] = useState(!!d.consent_at);
  const sd = useStudioData(user ? user.id : null);
  const [pick, setPick] = useState(null);
  const sel = pick || { studios: sd.myStudios, classes: sd.myClasses, other: !!d.studio_other };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [armed, setArmed] = useState(false);

  const last_ = step === STEPS.length - 1;
  const cur = STEPS[step].key;
  const toggleGoal = (g) => setGoals((x) => (x.includes(g) ? x.filter((i) => i !== g) : [...x, g]));
  const clean = (v) => (v.trim() ? v.trim() : null);

  const num = (v, min, max) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const bad = (v, min, max) => v.trim() !== '' && num(v, min, max) === null;
  const bodyBad = bad(height, 80, 250) || bad(weight, 20, 400) || bad(year, 1920, new Date().getFullYear());

  const pickPhoto = async (file) => {
    if (!file) return;
    try {
      const blob = await squarePhoto(file);
      setPhotoBlob(blob);
      setPhotoGone(false);
      setPhotoPrev((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    } catch {
      setErr(t('ob.photo.error'));
    }
  };
  const shownPhoto = photoPrev || (!photoGone && d.photo_path ? avatarUrl(d.photo_path) : '') || (photoGone ? '' : user && user.avatar) || '';

  const save = async () => {
    if (!consent) {
      setErr(t('ob.consent.required'));
      return;
    }
    setBusy(true);
    setErr('');
    const now = new Date().toISOString();
    let photo_path = photoGone ? null : d.photo_path || null;
    if (photoBlob) {
      const path = `${user.id}/${Date.now()}.jpg`;
      const up = await supabase.storage.from('avatars').upload(path, photoBlob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (up.error) {
        setBusy(false);
        setErr(t('ob.photo.error') + ' [' + (up.error.message || '') + ']');
        return;
      }
      photo_path = path;
    }
    const { error } = await supabase.from('student_details').upsert({
      student_id: user.id,
      first_name: clean(first),
      last_name: clean(last),
      contact_messenger: messenger && clean(handle) ? messenger : null,
      contact_handle: messenger ? clean(handle) : null,
      goals,
      height_cm: num(height, 80, 250),
      weight_kg: num(weight, 20, 400),
      birth_year: num(year, 1920, new Date().getFullYear()),
      gender: gender || null,
      studio_other: sel.other,
      photo_path,
      limitations: clean(limits),
      consent_at: d.consent_at || now,
      completed_at: now,
      updated_at: now
    });
    setBusy(false);
    if (error) {
      setErr(t('ob.saveError') + ' [' + (error.code || '') + ' ' + (error.message || '') + ']');
      return;
    }
    if (sd.loaded) {
      const sErr = await saveStudioChoice(user.id, sel.other ? [] : sel.studios, sel.other ? [] : sel.classes);
      if (sErr) {
        setErr(t('ob.saveError') + ' [' + (sErr.code || '') + ' ' + (sErr.message || '') + ']');
        return;
      }
    }
    if (d.photo_path && d.photo_path !== photo_path) supabase.storage.from('avatars').remove([d.photo_path]);
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
              <div className="photo-pick">
                <span className="avatar big-av" aria-hidden="true">
                  {shownPhoto ? <img src={shownPhoto} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={36} />}
                </span>
                <div className="stack">
                  <label className="btn-ghost file-btn">
                    {shownPhoto ? t('ob.photo.change') : t('ob.photo.add')}
                    <input type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files[0])} />
                  </label>
                  {(photoPrev || d.photo_path) && !photoGone && (
                    <button
                      type="button"
                      className="btn-ghost danger"
                      onClick={() => {
                        setPhotoBlob(null);
                        setPhotoPrev('');
                        setPhotoGone(true);
                      }}
                    >
                      {t('ob.photo.remove')}
                    </button>
                  )}
                </div>
              </div>
              <p className="small muted">{t('ob.photo.hint')}</p>
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

          {cur === 'studio' && <StudioPicker studios={sd.studios} classes={sd.classes} value={sel} onChange={setPick} />}

          {cur === 'goals' && (
            <div className="chips">
              {GOALS.map((g) => (
                <button type="button" key={g} className={'chip' + (goals.includes(g) ? ' active' : '')} aria-pressed={goals.includes(g)} onClick={() => toggleGoal(g)}>
                  {t(`ob.goal.${g}`)}
                </button>
              ))}
            </div>
          )}

          {cur === 'body' && (
            <div className="stack">
              <div className="gender-row" role="group" aria-label={t('ob.gender.label')}>
                {['male', 'female'].map((g) => (
                  <button type="button" key={g} className={'gender-btn' + (gender === g ? ' active' : '')} aria-pressed={gender === g} onClick={() => setGender(gender === g ? '' : g)}>
                    {t(`ob.gender.${g}`)}
                  </button>
                ))}
              </div>
              <input className="field" inputMode="decimal" value={height} maxLength={5} onChange={(e) => setHeight(e.target.value)} placeholder={t('ob.height')} aria-label={t('ob.height')} aria-invalid={bad(height, 80, 250)} />
              <input className="field" inputMode="decimal" value={weight} maxLength={5} onChange={(e) => setWeight(e.target.value)} placeholder={t('ob.weight')} aria-label={t('ob.weight')} aria-invalid={bad(weight, 20, 400)} />
              <input className="field" inputMode="numeric" value={year} maxLength={4} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} placeholder={t('ob.birthYear')} aria-label={t('ob.birthYear')} aria-invalid={bad(year, 1920, new Date().getFullYear())} />
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
            <button type="button" className="btn-primary" onClick={() => setStep(step + 1)} disabled={cur === 'body' && bodyBad}>
              {t('ob.next')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
