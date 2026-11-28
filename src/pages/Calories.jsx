import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent } from '../lib/content.jsx';
import { supabase } from '../lib/supabase.js';
import { LEVELS, bmr, bodyOf, complete, round10 } from '../lib/calories.js';

const num = (v, lo, hi) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

// Плитка «Калорії»: базовий обмін за даними з анкети; відсутні дані можна вписати тут; потім вибір активності.
export default function Calories() {
  const { t, locale } = useI18n();
  const { user, details, refreshDetails } = useAuth();
  const { sectionOpen } = useContent();
  const body = bodyOf(details);
  const ok = complete(body);
  const [editing, setEditing] = useState(false);
  const [gender, setGender] = useState(body.gender);
  const [height, setHeight] = useState(body.height ? String(body.height) : '');
  const [weight, setWeight] = useState(body.weight ? String(body.weight) : '');
  const [year, setYear] = useState(body.year ? String(body.year) : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [level, setLevel] = useState(() => {
    try {
      return localStorage.getItem('cal-level') || '';
    } catch {
      return '';
    }
  });

  // підхоплюємо дані анкети, коли вони завантажились
  useEffect(() => {
    setGender(body.gender);
    setHeight(body.height ? String(body.height) : '');
    setWeight(body.weight ? String(body.weight) : '');
    setYear(body.year ? String(body.year) : '');
  }, [details]); // eslint-disable-line react-hooks/exhaustive-deps
  // вибір активності зберігаємо і в акаунті (однаково на всіх пристроях)
  useEffect(() => {
    if (!user) return;
    supabase.auth.getSession().then(({ data }) => {
      const m = data && data.session && data.session.user && data.session.user.user_metadata;
      if (m && m.cal_level && LEVELS.some((l) => l.id === m.cal_level)) setLevel(m.cal_level);
    });
  }, [user]);
  const pickLevel = (id) => {
    setLevel(id);
    try {
      localStorage.setItem('cal-level', id);
    } catch {
      /* ignore */
    }
    supabase.auth.updateUser({ data: { cal_level: id } }).catch(() => {});
  };

  const save = async () => {
    const h = num(height, 80, 250);
    const w = num(weight, 20, 400);
    const y = num(year, 1920, new Date().getFullYear());
    if (!gender || !h || !w || !y) {
      setErr(t('cal.fill'));
      return;
    }
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('student_details').upsert({ student_id: user.id, gender, height_cm: h, weight_kg: w, birth_year: y, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) {
      setErr(t('ob.saveError') + ' [' + (error.code || '') + ' ' + (error.message || '') + ']');
      return;
    }
    await refreshDetails();
    setEditing(false);
  };

  if (!sectionOpen('calories')) return <Locked section="calories" title={t('cal.title')} />;

  const fmt = (n) => Math.round(n).toLocaleString(locale);
  const base = ok ? bmr(body) : 0;
  const lv = LEVELS.find((l) => l.id === level);
  const tdee = lv && ok ? base * lv.k : 0;
  const goals = (details && details.goals) || [];
  const rows = [];
  if (tdee && goals.includes('lose_weight')) rows.push({ k: 'lose', v: Math.max(round10(tdee * 0.85), round10(base)) });
  if (tdee && goals.includes('muscle')) rows.push({ k: 'gain', v: round10(tdee * 1.1) });

  return (
    <main className="page">
      <TopBar title={t('cal.title')} />

      {(!ok || editing) && (
        <section className="card stack">
          <h2 className="h2">{t('cal.dataTitle')}</h2>
          <p className="muted small">{t('cal.dataHint')}</p>
          <div className="gender-row" role="group" aria-label={t('ob.gender.label')}>
            {['male', 'female'].map((g) => (
              <button type="button" key={g} className={'gender-btn' + (gender === g ? ' active' : '')} aria-pressed={gender === g} onClick={() => setGender(g)}>
                {t(`ob.gender.${g}`)}
              </button>
            ))}
          </div>
          <input className="field" inputMode="numeric" value={year} placeholder={t('ob.birthYear')} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <input className="field" inputMode="decimal" value={height} placeholder={t('ob.height')} onChange={(e) => setHeight(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} />
          <input className="field" inputMode="decimal" value={weight} placeholder={t('ob.weight')} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, '').slice(0, 5))} />
          {err && <p className="error" role="alert">{err}</p>}
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>{t('cal.save')}</button>
        </section>
      )}

      {ok && !editing && (
        <>
          <section className="card stack">
            <h2 className="h2">{tdee > 0 ? t('cal.dayTitle') : t('cal.baseTitle')}</h2>
            <div className="row between cal-top">
              <span className="muted">{tdee > 0 ? t('cal.maintain') : t('cal.baseHint')}</span>
              <b className="cal-num">{fmt(tdee > 0 ? tdee : base)} {t('cal.unit')}</b>
            </div>
            {tdee > 0 && <span className="muted small">{t('cal.base')}: {fmt(base)} {t('cal.unit')}</span>}
            <button type="button" className="btn-ghost btn-small" onClick={() => setEditing(true)}>{t('cal.edit')}</button>
          </section>

          <section className="card stack">
            <h2 className="h2">{t('cal.activityTitle')}</h2>
            <div className="stack">
              {LEVELS.map((l) => (
                <button type="button" key={l.id} className={'also-row chat-pick' + (level === l.id ? ' on' : '')} onClick={() => pickLevel(l.id)} aria-pressed={level === l.id}>
                  <span>
                    <b>{t(`cal.lv.${l.id}`)}</b>
                    <br />
                    <span className="muted small">{t(`cal.lv.${l.id}.d`)}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {tdee > 0 && (
            <section className="card stack">
              <h2 className="h2">{t('cal.resultTitle')}</h2>
              <div className="row between">
                <span>{t('cal.base')}</span>
                <b className="cal-val">{fmt(base)} {t('cal.unit')}</b>
              </div>
              <div className="row between">
                <span>{t('cal.maintain')}</span>
                <b className="cal-val">{fmt(tdee)} {t('cal.unit')}</b>
              </div>
              {rows.map((r) => (
                <div className="row between" key={r.k}>
                  <span>{t(`cal.goal.${r.k}`)}</span>
                  <b className="cal-val">{fmt(r.v)} {t('cal.unit')}</b>
                </div>
              ))}
            </section>
          )}
          <p className="muted small">{t('cal.disclaimer')}</p>
        </>
      )}
    </main>
  );
}
