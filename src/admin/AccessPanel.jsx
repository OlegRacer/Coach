import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

const PRESETS = [7, 14, 30, 90];
const DAY = 86400000;

// Панель тренера: відкрити (продовжити) або закрити доступ до розділів на N днів.
// Якщо доступ ще діє, дні додаються до його кінця; якщо закінчився чи закритий, відлік іде від сьогодні.
// Колись цю панель замінить автоматичне відкриття після оплати: логіка запису в section_access та сама.
export default function AccessPanel({ student, rows, onChanged }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { rawSections, chainOf } = useContent();
  const L = useL();
  const pathOf = (id) => chainOf(id).map((a) => L(a.title) || a.id).join(' › ');
  const SECTIONS = [...rawSections].sort((a, b) => pathOf(a.id).localeCompare(pathOf(b.id)));
  const [picked, setPicked] = useState([]);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const byId = Object.fromEntries(rows.map((r) => [r.section, r.expires_at]));
  const fmt = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const left = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
  const status = (id) => {
    const exp = byId[id];
    if (!exp || new Date(exp).getTime() <= Date.now()) return t('students.accessNone');
    return t('students.accessLeft', { date: fmt(exp), n: left(exp) });
  };
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const n = Math.max(1, Math.min(3650, parseInt(days, 10) || 0));
  const valid = picked.length > 0 && (parseInt(days, 10) || 0) >= 1;

  const grant = async () => {
    setBusy(true);
    setErr(false);
    const now = Date.now();
    const payload = picked.map((id) => {
      const cur = byId[id] ? new Date(byId[id]).getTime() : 0;
      const base = Math.max(now, cur);
      return {
        student_id: student.id,
        section: id,
        expires_at: new Date(base + n * DAY).toISOString(),
        granted_by: user.id,
        updated_at: new Date().toISOString()
      };
    });
    const { error } = await supabase.from('section_access').upsert(payload);
    setBusy(false);
    if (error) setErr(true);
    else {
      setPicked([]);
      onChanged();
    }
  };

  const revoke = async () => {
    setBusy(true);
    setErr(false);
    const { error } = await supabase.from('section_access').delete().eq('student_id', student.id).in('section', picked);
    setBusy(false);
    if (error) setErr(true);
    else {
      setPicked([]);
      onChanged();
    }
  };

  return (
    <div className="access-panel">
      {SECTIONS.map((s) => (
        <label key={s.id} className="access-row">
          <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
          <span>
            {pathOf(s.id)}{!s.published && " ·  " + t("content.draft")}
            <small>{status(s.id)}</small>
          </span>
        </label>
      ))}

      <span className="muted small">{t('students.accessDays')}</span>
      <div className="chips">
        {PRESETS.map((d) => (
          <button type="button" key={d} className={'chip' + (n === d && String(days) === String(d) ? ' active' : '')} onClick={() => setDays(d)}>
            {t('students.accessDaysN', { n: d })}
          </button>
        ))}
      </div>
      <input
        className="field"
        inputMode="numeric"
        value={days}
        maxLength={4}
        onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))}
        placeholder={t('students.accessCustom')}
        aria-label={t('students.accessCustom')}
      />

      {err && <p className="small err" role="alert">{t('students.accessError')}</p>}
      <button type="button" className="btn-primary" disabled={busy || !valid} onClick={grant}>
        {picked.length ? t('students.accessGrant', { n }) : t('students.accessPick')}
      </button>
      <button type="button" className="btn-danger" disabled={busy || !picked.length} onClick={revoke}>
        {t('students.accessRevoke')}
      </button>
    </div>
  );
}
