import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { useStudioData } from '../lib/studios.js';
import { iso, useSchedule } from '../lib/schedule.js';

const OTHER = '__other';
const KINDS = ['app', 'package', 'class'];

// «Додати тренування»: своє тренування з додатка, пакет або офлайн клас у «Мій розклад».
export default function AddWorkout({ onClose, onSaved }) {
  const { t } = useI18n();
  const L = useL();
  const { user } = useAuth();
  const { rawSections, exercises, sectionOpen, exerciseOpen } = useContent();
  const sd = useStudioData(null);
  const sch = useSchedule();
  const [trainer, setTrainer] = useState('');
  const [slotId, setSlotId] = useState('');
  const [kind, setKind] = useState('');
  const [mode, setMode] = useState('prog'); // prog = готова програма, mine = своя
  const [progs, setProgs] = useState([]);
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState([]);
  const [setsOf, setSetsOf] = useState({});
  const [dayTime, setDayTime] = useState({}); // час окремих днів (довгий тап по обраному дню)
  const [editDay, setEditDay] = useState(null);
  const press = useRef({ timer: null, long: false });
  const [oStudio, setOStudio] = useState('');
  const [oClass, setOClass] = useState('');
  const [pick, setPick] = useState('');
  const [studio, setStudio] = useState('');
  const [packs, setPacks] = useState([]);
  const [repeat, setRepeat] = useState('weekly');
  const [weekdays, setWeekdays] = useState([((new Date().getDay() + 6) % 7) + 1]);
  const [date, setDate] = useState(iso(new Date()));
  const [time, setTime] = useState('18:00');
  const [dur, setDur] = useState('60');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('student_programs').select('id, title').eq('student_id', user.id).order('created_at', { ascending: false }).then(({ data }) => setProgs(data || []));
    supabase
      .from('student_packages')
      .select('id, plan, expires_at, closed_at')
      .eq('student_id', user.id)
      .is('closed_at', null)
      .order('granted_at', { ascending: false })
      .then(({ data }) => setPacks((data || []).filter((p) => new Date(p.expires_at).getTime() > Date.now())));
  }, [user]);

  const secs = rawSections.filter((s) => s.kind === 'exercises' && s.is_program && sectionOpen(s.id));
  const exs = exercises.filter((e) => exerciseOpen(e));

  // Офлайн клас: класи студії, у яких є заняття; тренер (якщо їх кілька); конкретне заняття
  const other = kind === 'class' && studio === OTHER;
  const classSlots = sch.slots.filter((x) => x.studio_id === studio && x.class_id === pick);
  const trainerIds = [...new Set(classSlots.map((x) => x.trainer_id))];
  const trainerName = (id) => (sch.trainers.find((x) => x.id === id) || {}).name || '';
  const trainerSel = trainerIds.length === 1 ? trainerIds[0] : trainer;
  const timeSlots = classSlots.filter((x) => !trainerSel || x.trainer_id === trainerSel);
  const classList = sd.classes.filter((c) => c.studio_id === studio);
  const withSlots = classList.filter((c) => sch.slots.some((x) => x.studio_id === studio && x.class_id === c.id));
  const classOptions = withSlots.length ? withSlots : classList;
  const effSlot = timeSlots.length === 1 ? timeSlots[0] : timeSlots.find((x) => x.id === slotId) || null;
  const chooseSlot = (id) => {
    setSlotId(id);
    const x = sch.slots.find((y) => y.id === id);
    if (!x) return;
    if (x.weekday != null) {
      setRepeat('weekly');
      setWeekdays([x.weekday]);
    } else {
      setRepeat('once');
      setDate(x.on_date);
    }
    setTime(x.start_time);
    setDur(String(x.duration_min));
  };
  const slotText = (x) => `${x.weekday != null ? t(`day.short.${x.weekday}`) : x.on_date} ${x.start_time}`;

  // що саме обрано → заголовок, місце, посилання
  const resolve = () => {
    if (kind === 'app') {
      if (mode === 'mine') return name.trim() && chosen.length ? { kind: 'program', ref_id: null, title: name.trim(), place: null } : null;
      const [type, id] = pick.split(':');
      if (type === 'program') {
        const g = progs.find((x) => x.id === id);
        return g && { kind: 'program', ref_id: id, title: g.title, place: null };
      }
      const sc = rawSections.find((x) => x.id === id);
      return sc && { kind: 'section', ref_id: id, title: L(sc.title) || id, place: null };
    }
    if (kind === 'package') {
      const p = packs.find((x) => x.id === pick);
      return p && { kind: 'package', ref_id: p.id, title: L((p.plan || {}).title) || t('pay.title'), place: null };
    }
    if (other) return oStudio.trim() && oClass.trim() ? { kind: 'class', ref_id: null, title: oClass.trim(), place: oStudio.trim() } : null;
    const c = sd.classes.find((x) => x.id === pick);
    const st = sd.studios.find((x) => x.id === studio);
    return c && { kind: 'class', ref_id: c.id, title: c.name, place: [st && st.name, trainerName(trainerSel)].filter(Boolean).join(' · ') || null };
  };
  const item = kind && (pick || (kind === 'app' && mode === 'mine') || other) ? resolve() : null;
  const isClass = kind === 'class' && !other;
  // Скільки днів на тиждень можна обрати: у програмі від тренера — скільки він задав; у власній — до 7; в інших — 1
  const progSec = kind === 'app' && mode === 'prog' && pick.startsWith('section:') ? rawSections.find((x) => x.id === pick.slice(8)) : null;
  const maxDays = kind === 'app' ? (mode === 'mine' ? 7 : progSec && progSec.days_per_week ? progSec.days_per_week : 7) : 1;
  const toggleDay = (n) => {
    if (weekdays.includes(n)) return weekdays.length > 1 && setWeekdays(weekdays.filter((x) => x !== n));
    if (maxDays === 1) return setWeekdays([n]);
    if (weekdays.length < maxDays) setWeekdays([...weekdays, n].sort());
  };
  const days = weekdays.slice(0, maxDays);
  const needTime = true; // час задається довгим тапом по дню; тривалість не питаємо
  const timeOf = (n) => (needTime ? dayTime[n] || time : '00:00');
  const startPress = (n) => {
    press.current.long = false;
    clearTimeout(press.current.timer);
    press.current.timer = setTimeout(() => {
      if (needTime && weekdays.includes(n)) {
        press.current.long = true;
        setEditDay(n);
        if (navigator.vibrate) navigator.vibrate(15);
      }
    }, 450);
  };
  const endPress = () => clearTimeout(press.current.timer);
  const ok = item && (isClass ? !!effSlot : time && (repeat === 'weekly' || date));

  const save = async () => {
    setBusy(true);
    setErr('');
    let row = item;
    if (kind === 'app' && mode === 'mine') {
      const r = await supabase.from('student_programs').insert({ student_id: user.id, title: name.trim(), exercise_ids: chosen, exercise_sets: Object.fromEntries(chosen.map((id) => [id, Math.min(20, Math.max(1, parseInt(setsOf[id], 10) || 3))])) }).select().single();
      if (r.error) {
        setBusy(false);
        return setErr(t('ob.saveError') + ' [' + (r.error.code || '') + ' ' + (r.error.message || '') + ']');
      }
      row = { ...item, ref_id: r.data.id };
    }
    const base = { student_id: user.id, ...row };
    const rows = isClass
      ? [{ ...base, weekday: effSlot.weekday, on_date: effSlot.on_date, start_time: effSlot.start_time, duration_min: effSlot.duration_min }]
      : (repeat === 'weekly' ? days : [null]).map((d) => ({
          ...base,
          weekday: d,
          on_date: repeat === 'once' ? date : null,
          start_time: d ? timeOf(d) : needTime ? time : '00:00',
          duration_min: 60
        }));
    const { error } = await supabase.from('student_plan_items').insert(rows);
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
            <>
              <div className="chips">
                {['prog', 'mine'].map((m) => (
                  <button key={m} type="button" className={'chip' + (mode === m ? ' active' : '')} onClick={() => { setMode(m); setPick(''); }}>
                    {t(m === 'prog' ? 'aw.program' : 'aw.createOwn')}
                  </button>
                ))}
              </div>
              {mode === 'prog' && (
                <>
                  {!secs.length && !progs.length && <p className="muted small">{t('aw.noPrograms')}</p>}
                  {(secs.length > 0 || progs.length > 0) && (
                    <select className="field" value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t('aw.program')}>
                      <option value="" disabled>{t('aw.choose')}</option>
                      {secs.length > 0 && (
                        <optgroup label={t('aw.programs')}>
                          {secs.map((x) => <option key={x.id} value={'section:' + x.id}>{L(x.title) || x.id}</option>)}
                        </optgroup>
                      )}
                      {progs.length > 0 && (
                        <optgroup label={t('aw.myPrograms')}>
                          {progs.map((x) => <option key={x.id} value={'program:' + x.id}>{x.title}</option>)}
                        </optgroup>
                      )}
                    </select>
                  )}
                </>
              )}
              {mode === 'mine' && (
                <div className="stack">
                  <input className="field" value={name} maxLength={120} placeholder={t('aw.programName')} onChange={(e) => setName(e.target.value)} />
                  <select className="field" value="" onChange={(e) => e.target.value && !chosen.includes(e.target.value) && setChosen([...chosen, e.target.value])} aria-label={t('aw.addExercise')}>
                    <option value="">{t('aw.addExercise')}</option>
                    {exs.filter((e) => !chosen.includes(e.id)).map((e) => <option key={e.id} value={e.id}>{L(e.title) || e.id}</option>)}
                  </select>
                  {chosen.map((id) => {
                    const e = exercises.find((x) => x.id === id);
                    return (
                      <div key={id} className="row" style={{ alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, minWidth: 0 }}>{e ? L(e.title) : id}</span>
                        <input
                          className="field"
                          style={{ width: 76, textAlign: 'center' }}
                          inputMode="numeric"
                          maxLength={2}
                          value={setsOf[id] ?? '3'}
                          onChange={(ev) => setSetsOf({ ...setsOf, [id]: ev.target.value.replace(/\D/g, '') })}
                          aria-label={t('aw.sets')}
                          placeholder={t('aw.sets')}
                        />
                        <button type="button" className="icon-btn trash-btn" aria-label={t('sa.delete')} onClick={() => setChosen(chosen.filter((x) => x !== id))}>
                          <Icon name="trash" size={20} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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
              <select className="field" value={studio} onChange={(e) => { setStudio(e.target.value); setPick(''); setTrainer(''); setSlotId(''); }} aria-label={t('sa.studio')}>
                <option value="" disabled>{t('sa.pickStudio')}</option>
                {sd.studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value={OTHER}>{t('aw.otherStudio')}</option>
              </select>
              {other && (
                <>
                  <input className="field" value={oStudio} maxLength={120} placeholder={t('sa.studioName')} onChange={(e) => setOStudio(e.target.value)} />
                  <input className="field" value={oClass} maxLength={120} placeholder={t('sa.className')} onChange={(e) => setOClass(e.target.value)} />
                </>
              )}
              {studio && !other && (
                <select className="field" value={pick} onChange={(e) => { setPick(e.target.value); setTrainer(''); setSlotId(''); }} aria-label={t('sa.class')}>
                  <option value="" disabled>{t('sa.pickClass')}</option>
                  {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
              {pick && trainerIds.length > 1 && (
                <select className="field" value={trainer} onChange={(e) => { setTrainer(e.target.value); setSlotId(''); }} aria-label={t('sa.trainer')}>
                  <option value="" disabled>{t('aw.pickTrainer')}</option>
                  {trainerIds.map((id) => <option key={id} value={id}>{trainerName(id)}</option>)}
                </select>
              )}
              {pick && trainerSel && timeSlots.length > 1 && (
                <select className="field" value={slotId} onChange={(e) => chooseSlot(e.target.value)} aria-label={t('aw.pickSlot')}>
                  <option value="" disabled>{t('aw.pickSlot')}</option>
                  {timeSlots.map((x) => <option key={x.id} value={x.id}>{slotText(x)}</option>)}
                </select>
              )}
            </>
          )}

          {isClass && pick && !classSlots.length && <p className="muted small">{t('aw.noSlots')}</p>}
          {isClass && effSlot && (
            <p className="body">
              <b>{effSlot.weekday != null ? t(`day.long.${effSlot.weekday}`) : effSlot.on_date}, {effSlot.start_time}</b> · {t('common.minutes', { n: effSlot.duration_min })}
            </p>
          )}
          {kind && (kind !== 'class' || other) && (other ? oStudio.trim() && oClass.trim() : pick || (kind === 'app' && mode === 'mine' && name.trim() && chosen.length > 0)) && (
            <div className="stack">
              <div className="chips">
                {['weekly', 'once'].map((r) => (
                  <button key={r} type="button" className={'chip' + (repeat === r ? ' active' : '')} onClick={() => setRepeat(r)}>
                    {t(r === 'weekly' ? 'sa.repeat' : 'sa.once')}
                  </button>
                ))}
              </div>
              {repeat === 'weekly' ? (
                <>
                <div className="chips">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={'chip day-chip' + (days.includes(n) ? ' active' : '')}
                      aria-pressed={days.includes(n)}
                      onPointerDown={() => startPress(n)}
                      onPointerUp={endPress}
                      onPointerLeave={endPress}
                      onPointerCancel={endPress}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => {
                        if (press.current.long) {
                          press.current.long = false;
                          return;
                        }
                        toggleDay(n);
                      }}
                    >
                      <span>{t(`day.short.${n}`)}</span>
                      {needTime && days.includes(n) && <small className="day-time">{timeOf(n)}</small>}
                    </button>
                  ))}
                  {needTime && editDay && days.includes(editDay) && (
                    <div className="row" style={{ width: '100%', alignItems: 'center', gap: 8 }}>
                      <span>{t(`day.long.${editDay}`)}</span>
                      <input className="field" type="time" value={timeOf(editDay)} onChange={(e) => setDayTime({ ...dayTime, [editDay]: e.target.value })} aria-label={t('sa.time')} />
                      <button type="button" className="btn-ghost btn-small" onClick={() => setEditDay(null)}>OK</button>
                    </div>
                  )}
                  {needTime && <p className="muted small" style={{ width: '100%' }}>{t('aw.longTap')}</p>}
                  {maxDays > 1 && maxDays < 7 && <p className="muted small" style={{ width: '100%' }}>{t('aw.maxDays', { n: maxDays })}</p>}
                </div>
                </>
              ) : (
                <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('sa.date')} />
              )}
              <div className="row">
                {repeat === 'once' && <input className="field" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label={t('sa.time')} />}
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
