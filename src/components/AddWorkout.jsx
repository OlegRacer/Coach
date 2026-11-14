import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { useStudioData } from '../lib/studios.js';
import { iso } from '../lib/schedule.js';

const KINDS = ['app', 'package', 'class'];

// «Додати тренування»: своє тренування з додатка, пакет або офлайн клас у «Мій розклад».
export default function AddWorkout({ onClose, onSaved }) {
  const { t } = useI18n();
  const L = useL();
  const { user } = useAuth();
  const { rawSections, exercises, sectionOpen, exerciseOpen } = useContent();
  const sd = useStudioData(null);
  const [kind, setKind] = useState('');
  const [pick, setPick] = useState('');
  const [studio, setStudio] = useState('');
  const [packs, setPacks] = useState([]);
  const [repeat, setRepeat] = useState('weekly');
  const [weekday, setWeekday] = useState(((new Date().getDay() + 6) % 7) + 1);
  const [date, setDate] = useState(iso(new Date()));
  const [time, setTime] = useState('18:00');
  const [dur, setDur] = useState('60');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('student_packages')
      .select('id, plan, expires_at, closed_at')
      .eq('student_id', user.id)
      .is('closed_at', null)
      .order('granted_at', { ascending: false })
      .then(({ data }) => setPacks((data || []).filter((p) => new Date(p.expires_at).getTime() > Date.now())));
  }, [user]);

  const secs = rawSections.filter((s) => s.kind === 'exercises' && sectionOpen(s.id));
  const exs = exercises.filter((e) => exerciseOpen(e));

  // що саме обрано → заголовок, місце, посилання
  const resolve = () => {
    if (kind === 'app') {
      const [type, id] = pick.split(':');
      if (type === 'section') {
        const s = rawSections.find((x) => x.id === id);
        return s && { kind: 'section', ref_id: id, title: L(s.title) || id, place: null };
      }
      const e = exercises.find((x) => x.id === id);
      return e && { kind: 'exercise', ref_id: id, title: L(e.title) || id, place: null };
    }
    if (kind === 'package') {
      const p = packs.find((x) => x.id === pick);
      return p && { kind: 'package', ref_id: p.id, title: L((p.plan || {}).title) || t('pay.title'), place: null };
    }
    const c = sd.classes.find((x) => x.id === pick);
    const st = sd.studios.find((x) => x.id === studio);
    return c && { kind: 'class', ref_id: c.id, title: c.name, place: st ? st.name : null };
  };
  const item = kind && pick ? resolve() : null;
  const ok = item && time && (repeat === 'weekly' || date);

  const save = async () => {
    setBusy(true);
    setErr('');
    const { error } = await supabase.from('student_plan_items').insert({
      student_id: user.id,
      ...item,
      weekday: repeat === 'weekly' ? weekday : null,
      on_date: repeat === 'once' ? date : null,
      start_time: time,
      duration_min: Math.max(5, parseInt(dur, 10) || 60)
    });
    setBusy(false);
    if (error) return setErr(t('ob.saveError') + ' [' + (error.code || '') + ' ' + (error.message || '') + ']');
    onSaved();
    onClose();
  };

  return createPortal(
    <div className="ob-root" role="dialog" aria-modal="true" aria-labelledby="aw-title">
      <div className="ob">
        <div className="ob-top">
          <button type="button" className="back" onClick={kind ? () => { setKind(''); setPick(''); } : onClose} aria-label={t('ob.back')}>
            <Icon name="back" size={22} />
          </button>
          <span className="ob-dots" />
          <span className="back-spacer" />
        </div>
        <div className="ob-body">
          <h1 id="aw-title" className="title">{t('aw.title')}</h1>
          {!kind && (
            <div className="list">
              {KINDS.map((k) => (
                <button type="button" key={k} className="list-item link-row" onClick={() => setKind(k)}>
                  <span className="list-main">
                    <span className="list-title">{t(`aw.kind.${k}`)}</span>
                    <span className="muted small">{t(`aw.kind.${k}.hint`)}</span>
                  </span>
                  <Icon name="chevron" size={20} />
                </button>
              ))}
            </div>
          )}

          {kind === 'app' && (
            <select className="field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t('aw.kind.app')}>
              <option value="" disabled>{t('aw.choose')}</option>
              {secs.length > 0 && (
                <optgroup label={t('aw.sections')}>
                  {secs.map((s) => <option key={s.id} value={'section:' + s.id}>{L(s.title) || s.id}</option>)}
                </optgroup>
              )}
              {exs.length > 0 && (
                <optgroup label={t('aw.exercises')}>
                  {exs.map((e) => <option key={e.id} value={'exercise:' + e.id}>{L(e.title) || e.id}</option>)}
                </optgroup>
              )}
            </select>
          )}
          {kind === 'package' && (
            <>
              {!packs.length && <p className="muted small">{t('aw.noPacks')}</p>}
              {packs.length > 0 && (
                <select className="field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t('aw.kind.package')}>
                  <option value="" disabled>{t('aw.choose')}</option>
                  {packs.map((p) => <option key={p.id} value={p.id}>{L((p.plan || {}).title) || t('pay.title')}</option>)}
                </select>
              )}
            </>
          )}
          {kind === 'class' && (
            <>
              <select className="field" value={studio} onChange={(e) => { setStudio(e.target.value); setPick(''); }} aria-label={t('sa.studio')}>
                <option value="" disabled>{t('sa.pickStudio')}</option>
                {sd.studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {studio && (
                <select className="field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t('sa.class')}>
                  <option value="" disabled>{t('sa.pickClass')}</option>
                  {sd.classes.filter((c) => c.studio_id === studio).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </>
          )}

          {kind && pick && (
            <div className="stack">
              <div className="chips">
                {['weekly', 'once'].map((r) => (
                  <button key={r} type="button" className={'chip' + (repeat === r ? ' active' : '')} onClick={() => setRepeat(r)}>
                    {t(r === 'weekly' ? 'sa.repeat' : 'sa.once')}
                  </button>
                ))}
              </div>
              {repeat === 'weekly' ? (
                <div className="chips">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button key={n} type="button" className={'chip' + (weekday === n ? ' active' : '')} onClick={() => setWeekday(n)}>
                      {t(`day.short.${n}`)}
                    </button>
                  ))}
                </div>
              ) : (
                <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('sa.date')} />
              )}
              <div className="row">
                <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t('sa.time')} />
                <input className="field" inputMode="numeric" value={dur} maxLength={3} onChange={(e) => setDur(e.target.value.replace(/\D/g, ''))} placeholder={t('sa.duration')} aria-label={t('sa.duration')} />
              </div>
            </div>
          )}
          {err && <p className="small err" role="alert">{err}</p>}
        </div>
        <div className="ob-foot">
          <button type="button" className="btn-primary" disabled={!ok || busy} onClick={save}>
            {t('sa.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
