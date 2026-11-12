import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { ConfirmButton } from './ContentCommon.jsx';

const PRESETS = [7, 14, 30, 90];
const DAY = 86400000;

// Панель тренера: відкрити (продовжити) або закрити доступ до розділів на N днів.
// Якщо доступ ще діє, дні додаються до його кінця; якщо закінчився чи закритий, відлік іде від сьогодні.
// Колись цю панель замінить автоматичне відкриття після оплати: логіка запису в section_access та сама.
export default function AccessPanel({ student, rows, onChanged }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { rawSections, chainOf, exercises, exercise, subtreeIds } = useContent();
  const L = useL();
  const pathOf = (id) => chainOf(id).map((a) => L(a.title) || a.id).join(' › ');
  const SECTIONS = [...rawSections].sort((a, b) => pathOf(a.id).localeCompare(pathOf(b.id)));
  const [picked, setPicked] = useState([]);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  // Окремі вправи (куплені в пакеті) і історія оплат цього учня.
  const [exRows, setExRows] = useState([]);
  const [packs, setPacks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [planId, setPlanId] = useState('');
  const loadExtra = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('exercise_access').select('exercise_id, expires_at').eq('student_id', student.id),
      supabase.from('student_packages').select('*').eq('student_id', student.id).order('granted_at', { ascending: false }).limit(30)
    ]);
    setExRows((a.data || []).filter((r) => new Date(r.expires_at).getTime() > Date.now()));
    setPacks(b.data || []);
    const pl = await supabase.from('access_plans').select('id, title').order('position');
    setPlans(pl.data || []);
  }, [student.id]);
  useEffect(() => {
    loadExtra();
  }, [loadExtra, rows]);
  const revokeEx = async (id) => {
    setBusy(true);
    const { error } = await supabase.from('exercise_access').delete().eq('student_id', student.id).eq('exercise_id', id);
    setBusy(false);
    if (error) setErr(true);
    else {
      loadExtra();
      onChanged();
    }
  };
  // Закрити пакет: забираємо те, що він відкрив (розділи й вправи).
  const closePack = async (p) => {
    setBusy(true);
    const { error } = await supabase.rpc('close_package', { p_id: p.id });
    setBusy(false);
    setErr(!!error);
    loadExtra();
    onChanged();
  };
  // Прибрати закритий чи завершений пакет зі списку (доступ це не змінює).
  const deletePack = async (p) => {
    setBusy(true);
    const { error } = await supabase.from('student_packages').delete().eq('id', p.id);
    setBusy(false);
    setErr(!!error);
    loadExtra();
  };
  const givePack = async () => {
    if (!planId) return;
    setBusy(true);
    const { error } = await supabase.rpc('grant_plan', { p_student: student.id, p_plan: planId });
    setBusy(false);
    setErr(!!error);
    setPlanId('');
    loadExtra();
    onChanged();
  };
  const packEnd = (p) => new Date(p.expires_at).getTime();
  const packItems = (p) => [
    ...((p.plan && p.plan.sections) || []).map((id) => pathOf(id)),
    ...((p.plan && p.plan.exercises) || []).map((id) => { const e = exercise(id); return e ? L(e.title) || id : id; })
  ].filter(Boolean).join(', ');
  const exInSection = (id) => {
    const ids = new Set(subtreeIds(id));
    return exRows.filter((r) => {
      const e = exercises.find((x) => x.id === r.exercise_id);
      return e && ids.has(e.section_id);
    }).length;
  };

  const byId = Object.fromEntries(rows.map((r) => [r.section, r.expires_at]));
  const fmt = (iso) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const left = (iso) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
  const status = (id) => {
    const exp = byId[id];
    if (!exp || new Date(exp).getTime() <= Date.now()) {
      const k = exInSection(id);
      return k ? t('students.accessPartial', { n: k }) : t('students.accessNone');
    }
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
      <span className="muted small">{t('students.packs')}</span>
      {!packs.length && <p className="muted small">{t('students.packsNone')}</p>}
      {packs.map((p) => {
        const end = packEnd(p);
        const active = !p.closed_at && end > Date.now();
        return (
          <div key={p.id} className={'access-row pack-row' + (active ? '' : ' pack-off')}>
            <span>
              <b>{L(p.plan && p.plan.title) || '—'}</b>
              <small>
                {active ? t('students.accessLeft', { date: fmt(new Date(end).toISOString()), n: left(new Date(end).toISOString()) }) : p.closed_at ? t('students.packClosed') : t('students.packEnded')}
                {' · '}{new Date(p.granted_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}{p.source === 'manual' ? ' · ' + t('students.packManual') : ''}
              </small>
              <small>{packItems(p)}</small>
            </span>
            {active ? (
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => closePack(p)}>{t('students.accessRevokeOne')}</button>
            ) : (
              <ConfirmButton label={t('mem.delete')} confirmLabel={t('pay.delConfirm')} onConfirm={() => deletePack(p)} />
            )}
          </div>
        );
      })}

      {plans.length > 0 && (
        <div className="row">
          <select className="field" value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label={t('students.packGive')}>
            <option value="">{t('students.packGive')}</option>
            {plans.map((pl) => <option key={pl.id} value={pl.id}>{L(pl.title) || pl.id}</option>)}
          </select>
          <button type="button" className="btn-primary" disabled={busy || !planId} onClick={givePack}>{t('students.packGiveBtn')}</button>
        </div>
      )}

      <details className="ex-pick">
        <summary>{t('students.manual')}</summary>
      {SECTIONS.map((s) => (
        <label key={s.id} className="access-row">
          <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} />
          <span>
            {pathOf(s.id)}{!s.published && " ·  " + t("content.draft")}
            <small>{status(s.id)}</small>
          </span>
        </label>
      ))}

      {exRows.length > 0 && (
        <>
          <span className="muted small">{t('students.accessExercises')}</span>
          {exRows.map((r) => {
            const e = exercise(r.exercise_id);
            const sec = e && chainOf(e.section_id).map((a) => L(a.title) || a.id).join(' › ');
            return (
              <div key={r.exercise_id} className="access-row">
                <span>
                  {e ? L(e.title) || e.id : r.exercise_id}
                  <small>{sec ? sec + ' · ' : ''}{t('students.accessLeft', { date: fmt(r.expires_at), n: left(r.expires_at) })}</small>
                </span>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => revokeEx(r.exercise_id)}>{t('students.accessRevokeOne')}</button>
              </div>
            );
          })}
        </>
      )}
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
      </details>
    </div>
  );
}
