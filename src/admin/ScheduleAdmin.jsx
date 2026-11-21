import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { iso, nextOf } from '../lib/schedule.js';
import { weekdayOf } from '../lib/dates.js';

const NEW = '__new';
const blank = { studio_id: '', new_studio: '', class_id: '', new_class: '', trainer_id: '', repeat: 'weekly', weekday: 1, on_date: '', start_time: '18:00', duration_min: 60 };


const fmt = (d) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
const parse = (d) => new Date(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));

// Редагування одного заняття: скасувати/перенести окрему дату, пауза серії, зміна часу для всіх
function SlotEditor({ slot, exs, run, t }) {
  const [pick, setPick] = useState('');
  const [mv, setMv] = useState(null);
  const [pf, setPf] = useState(slot.pause_from || '');
  const [pt, setPt] = useState(slot.pause_to || '');
  const [ser, setSer] = useState({ weekday: slot.weekday || 1, start_time: slot.start_time, duration_min: slot.duration_min });
  const mine = exs.filter((e) => e.slot_id === slot.id).sort((a, b) => a.orig_date.localeCompare(b.orig_date));
  const today = new Date();
  const dates = [];
  if (slot.weekday != null) {
    for (let i = 0; i < 70 && dates.length < 8; i += 1) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      if (weekdayOf(d) === slot.weekday) dates.push(iso(d));
    }
  } else if (slot.on_date) dates.push(slot.on_date);
  const exOf = (d) => mine.find((e) => e.orig_date === d);
  const put = (row) => run(supabase.from('slot_exceptions').upsert({ slot_id: slot.id, ...row }, { onConflict: 'slot_id,orig_date' }));
  const done = (ok) => ok && (setPick(''), setMv(null));
  const sel = pick && !exOf(pick);

  return (
    <div className="access-panel" style={{ marginTop: 8 }}>
      <span className="muted small">{t('sa.pickDate')}</span>
      <div className="chips">
        {dates.map((d) => {
          const e = exOf(d);
          return (
            <button key={d} type="button" className={'chip' + (pick === d ? ' active' : '')} onClick={() => { setPick(d); setMv({ new_date: d, new_time: slot.start_time }); }}>
              {t(`day.short.${weekdayOf(parse(d))}`)} {fmt(d)}{e ? (e.kind === 'cancel' ? ' ✕' : ' →') : ''}
            </button>
          );
        })}
      </div>
      {sel && mv && (
        <div className="stack">
          <button type="button" className="btn-danger" onClick={async () => done(await put({ orig_date: pick, kind: 'cancel', new_date: null, new_time: null }))}>
            {t('sa.cancelOne', { d: fmt(pick) })}
          </button>
          <span className="muted small">{t('sa.moveTo')}</span>
          <div className="row">
            <input className="field" type="date" value={mv.new_date} onChange={(e) => setMv({ ...mv, new_date: e.target.value })} aria-label={t('sa.date')} />
            <input className="field" type="time" value={mv.new_time} onChange={(e) => setMv({ ...mv, new_time: e.target.value })} aria-label={t('sa.time')} />
          </div>
          <button type="button" className="btn-primary" disabled={!mv.new_date || !mv.new_time} onClick={async () => done(await put({ orig_date: pick, kind: 'move', new_date: mv.new_date, new_time: mv.new_time }))}>
            {t('sa.moveOne', { d: fmt(pick) })}
          </button>
        </div>
      )}
      {mine.length > 0 && (
        <div className="stack">
          <span className="muted small">{t('sa.changes')}</span>
          {mine.map((e) => (
            <div key={e.id} className="row" style={{ alignItems: 'center' }}>
              <span style={{ flex: 1 }}>
                {fmt(e.orig_date)} · {e.kind === 'cancel' ? t('sa.cancelled') : `→ ${fmt(e.new_date)} ${String(e.new_time || slot.start_time).slice(0, 5)}`}
              </span>
              <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '0 14px' }} onClick={() => run(supabase.from('slot_exceptions').delete().eq('id', e.id))}>
                {t('sa.restore')}
              </button>
            </div>
          ))}
        </div>
      )}
      {slot.weekday != null && (
        <div className="stack">
          <span className="muted small">{t('sa.pause')}</span>
          <div className="row">
            <input className="field" type="date" value={pf} onChange={(e) => setPf(e.target.value)} aria-label={t('sa.from')} />
            <input className="field" type="date" value={pt} min={pf} onChange={(e) => setPt(e.target.value)} aria-label={t('sa.to')} />
          </div>
          <div className="row">
            <button type="button" className="btn-primary" disabled={!pf || !pt || pt < pf} onClick={() => run(supabase.from('schedule_slots').update({ pause_from: pf, pause_to: pt }).eq('id', slot.id))}>
              {t('sa.pauseSave')}
            </button>
            {(slot.pause_from || slot.pause_to) && (
              <button type="button" className="btn-ghost" onClick={async () => { if (await run(supabase.from('schedule_slots').update({ pause_from: null, pause_to: null }).eq('id', slot.id))) { setPf(''); setPt(''); } }}>
                {t('sa.pauseClear')}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="stack">
        <span className="muted small">{t('sa.editAll')}</span>
        {slot.weekday != null && (
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" className={'chip' + (Number(ser.weekday) === n ? ' active' : '')} onClick={() => setSer({ ...ser, weekday: n })}>{t(`day.short.${n}`)}</button>
            ))}
          </div>
        )}
        <div className="row">
          <input className="field" type="time" value={ser.start_time} onChange={(e) => setSer({ ...ser, start_time: e.target.value })} aria-label={t('sa.time')} />
          <input className="field" inputMode="numeric" value={ser.duration_min} maxLength={3} onChange={(e) => setSer({ ...ser, duration_min: e.target.value.replace(/\D/g, '') })} aria-label={t('sa.duration')} />
        </div>
        <button type="button" className="btn-ghost" disabled={!ser.start_time} onClick={() => run(supabase.from('schedule_slots').update({ ...(slot.weekday != null ? { weekday: Number(ser.weekday) } : {}), start_time: ser.start_time, duration_min: Math.max(5, parseInt(ser.duration_min, 10) || 60) }).eq('id', slot.id))}>
          {t('sa.save')}
        </button>
      </div>
    </div>
  );
}

// Адмінка розкладу: тренери і заняття (щотижня або на дату).
export default function ScheduleAdmin() {
  const { t } = useI18n();
  const { ready, isAdmin } = useAuth();
  const [trainers, setTrainers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [exs, setExs] = useState([]);
  const [params] = useSearchParams();
  const [editId, setEditId] = useState(params.get('edit'));
  useEffect(() => {
    if (!editId || !slots.length) return;
    const el = document.getElementById('slot-' + editId);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [slots.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [studios, setStudios] = useState([]);
  const [classes, setClasses] = useState([]);
  const [newTrainer, setNewTrainer] = useState('');
  const [form, setForm] = useState(null);
  const [armed, setArmed] = useState(null);
  const [openStudio, setOpenStudio] = useState(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const st = await supabase.from('studios').select('*').order('sort').order('created_at');
    setStudios(st.error ? [] : st.data || []);
    const cl = await supabase.from('studio_classes').select('*').order('sort').order('created_at');
    setClasses(cl.error ? [] : cl.data || []);
    const [tr, sl, xs] = await Promise.all([
      supabase.from('trainers').select('*').order('sort').order('created_at'),
      supabase.from('schedule_slots').select('*').order('start_time'),
      supabase.from('slot_exceptions').select('*')
    ]);
    setExs(xs.error ? [] : xs.data || []);
    if (tr.error || sl.error) {
      setErr(true);
      return;
    }
    setTrainers(tr.data || []);
    setSlots((sl.data || []).map((s) => ({ ...s, start_time: String(s.start_time).slice(0, 5) })));
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const run = async (q) => {
    setErr(false);
    const { error } = await q;
    if (error) setErr(true);
    else await load();
    return !error;
  };
  const confirm = (key, fn) => {
    if (armed !== key) {
      setArmed(key);
      return;
    }
    setArmed(null);
    fn();
  };

  const addTrainer = async () => {
    const name = newTrainer.trim();
    if (!name) return;
    if (await run(supabase.from('trainers').insert({ name, sort: trainers.length }))) setNewTrainer('');
  };

  const saveSlot = async () => {
    const f = form;
    setErr(false);
    let studioId = f.studio_id;
    let classId = f.class_id;
    if (studioId === NEW) {
      const r = await supabase.from('studios').insert({ name: f.new_studio.trim(), sort: studios.length }).select().single();
      if (r.error) return setErr(true);
      studioId = r.data.id;
    }
    let className = (classes.find((c) => c.id === classId) || {}).name;
    if (classId === NEW || studioId !== f.studio_id) {
      className = f.new_class.trim();
      const r = await supabase.from('studio_classes').insert({ studio_id: studioId, name: className, sort: classes.filter((c) => c.studio_id === studioId).length }).select().single();
      if (r.error) return setErr(true);
      classId = r.data.id;
    }
    const row = {
      trainer_id: f.trainer_id,
      title: className,
      studio_id: studioId,
      class_id: classId,
      place: null,
      weekday: f.repeat === 'weekly' ? Number(f.weekday) : null,
      on_date: f.repeat === 'once' ? f.on_date : null,
      start_time: f.start_time,
      duration_min: Math.max(5, parseInt(f.duration_min, 10) || 60)
    };
    if (await run(supabase.from('schedule_slots').insert(row))) setForm(null);
    else load();
  };
  const studioOk = form && (form.studio_id === NEW ? form.new_studio.trim() : form.studio_id);
  const classOk = form && (form.studio_id === NEW || form.class_id === NEW ? form.new_class.trim() : form.class_id);
  const formOk = form && form.trainer_id && studioOk && classOk && form.start_time && (form.repeat === 'weekly' || form.on_date);

  if (!ready) return <main className="page" />;
  if (!isAdmin) {
    return (
      <main className="page">
        <TopBar title={t('sa.title')} />
        <p className="muted">{t('students.noAccess')}</p>
      </main>
    );
  }

  const when = (s) => (s.weekday != null ? t(`day.short.${s.weekday}`) : fmt(s.on_date));

  return (
    <main className="page">
      <TopBar title={t('sa.title')} />
      {err && <p className="err" role="alert">{t('sa.error')}</p>}

      <h2 className="h2 section-title">{t('sched.trainers')}</h2>
      <div className="list">
        {trainers.map((x) => (
          <div key={x.id} className="list-item">
            <input
              className="field"
              defaultValue={x.name}
              maxLength={80}
              aria-label={t('sa.trainerName')}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== x.name) run(supabase.from('trainers').update({ name: v }).eq('id', x.id));
              }}
            />
            <button
              type="button"
              className="btn-danger"
              style={{ width: 'auto', padding: '0 14px' }}
              onClick={() => confirm('t' + x.id, () => run(supabase.from('trainers').delete().eq('id', x.id)))}
            >
              {armed === 't' + x.id ? t('sa.deleteTrainerConfirm') : t('sa.delete')}
            </button>
          </div>
        ))}
        <div className="row">
          <input className="field" value={newTrainer} maxLength={80} placeholder={t('sa.trainerName')} onChange={(e) => setNewTrainer(e.target.value)} />
          <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0 18px' }} disabled={!newTrainer.trim()} onClick={addTrainer}>
            {t('sa.addTrainer')}
          </button>
        </div>
      </div>

      <h2 className="h2 section-title">{t('sa.studios')}</h2>
      {!studios.length && <p className="muted small">{t('sa.studiosEmpty')}</p>}
      {studios.map((x) => {
        const cls = classes.filter((c) => c.studio_id === x.id);
        const open = openStudio === x.id;
        return (
          <section key={x.id} className={'card studio' + (open ? ' open' : '')}>
            <button type="button" className="studio-head" aria-expanded={open} onClick={() => setOpenStudio(open ? null : x.id)}>
              <span className="studio-name">{x.name}</span>
              <span className="muted small">{cls.length}</span>
              <span className="fold-chev" aria-hidden="true"><Icon name="chevron" size={18} /></span>
            </button>
            {open && (
              <div className="studio-body">
                {cls.map((c) => (
                  <div key={c.id} className="studio-row">
                    <span className="studio-cls">{c.name}</span>
                    <button
                      type="button"
                      className={'icon-btn trash-btn' + (armed === 'c' + c.id ? ' armed' : '')}
                      aria-label={t('sa.delete')}
                      onClick={() => confirm('c' + c.id, () => run(supabase.from('studio_classes').delete().eq('id', c.id)))}
                    >
                      {armed === 'c' + c.id ? <span className="small">{t('sa.deleteConfirm')}</span> : <Icon name="trash" size={20} />}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={'btn-danger studio-del' + (armed === 'g' + x.id ? ' armed' : '')}
                  onClick={() => confirm('g' + x.id, () => run(supabase.from('studios').delete().eq('id', x.id)))}
                >
                  {armed === 'g' + x.id ? t('sa.deleteConfirm') : t('sa.delete')}
                </button>
              </div>
            )}
          </section>
        );
      })}

      <h2 className="h2 section-title">{t('sa.slots')}</h2>
      {!trainers.length && <p className="muted small">{t('sa.needTrainer')}</p>}
      {trainers.length > 0 && !form && (
        <button type="button" className="btn-primary" onClick={() => setForm({ ...blank, trainer_id: trainers[0].id })}>
          {t('sa.addSlot')}
        </button>
      )}

      {form && (
        <div className="access-panel">
          <select className="field" value={form.trainer_id} onChange={(e) => setForm({ ...form, trainer_id: e.target.value })} aria-label={t('sa.trainer')}>
            {trainers.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
          <select className="field" value={form.studio_id} onChange={(e) => setForm({ ...form, studio_id: e.target.value, class_id: '' })} aria-label={t('sa.studio')}>
            <option value="" disabled>{t('sa.pickStudio')}</option>
            {studios.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
            <option value={NEW}>{t('sa.newStudio')}</option>
          </select>
          {form.studio_id === NEW && (
            <input className="field" value={form.new_studio} maxLength={120} placeholder={t('sa.studioName')} onChange={(e) => setForm({ ...form, new_studio: e.target.value })} />
          )}
          {form.studio_id && (
            <select className="field" value={form.studio_id === NEW ? NEW : form.class_id} disabled={form.studio_id === NEW} onChange={(e) => setForm({ ...form, class_id: e.target.value })} aria-label={t('sa.class')}>
              <option value="" disabled>{t('sa.pickClass')}</option>
              {classes.filter((c) => c.studio_id === form.studio_id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value={NEW}>{t('sa.newClass')}</option>
            </select>
          )}
          {(form.studio_id === NEW || form.class_id === NEW) && (
            <input className="field" value={form.new_class} maxLength={120} placeholder={t('sa.className')} onChange={(e) => setForm({ ...form, new_class: e.target.value })} />
          )}
          <div className="chips">
            {['weekly', 'once'].map((r) => (
              <button key={r} type="button" className={'chip' + (form.repeat === r ? ' active' : '')} onClick={() => setForm({ ...form, repeat: r })}>
                {t(r === 'weekly' ? 'sa.repeat' : 'sa.once')}
              </button>
            ))}
          </div>
          {form.repeat === 'weekly' ? (
            <div className="chips">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" className={'chip' + (Number(form.weekday) === n ? ' active' : '')} onClick={() => setForm({ ...form, weekday: n })}>
                  {t(`day.short.${n}`)}
                </button>
              ))}
            </div>
          ) : (
            <input className="field" type="date" value={form.on_date} onChange={(e) => setForm({ ...form, on_date: e.target.value })} aria-label={t('sa.date')} />
          )}
          <div className="row">
            <input className="field" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} aria-label={t('sa.time')} />
            <input className="field" inputMode="numeric" value={form.duration_min} maxLength={3} onChange={(e) => setForm({ ...form, duration_min: e.target.value.replace(/\D/g, '') })} placeholder={t('sa.duration')} aria-label={t('sa.duration')} />
          </div>
          <button type="button" className="btn-primary" disabled={!formOk} onClick={saveSlot}>{t('sa.save')}</button>
          <button type="button" className="btn-ghost" onClick={() => setForm(null)}>{t('sa.cancel')}</button>
        </div>
      )}

      {trainers.map((tr) => {
        const mine = slots.filter((s) => s.trainer_id === tr.id);
        if (!mine.length) return null;
        return (
          <section key={tr.id} className="card">
            <h2 className="h2">{tr.name}</h2>
            {mine.map((s) => {
              const withEx = { ...s, ex: Object.fromEntries(exs.filter((e) => e.slot_id === s.id).map((e) => [e.orig_date, { kind: e.kind, new_date: e.new_date, new_time: e.new_time ? String(e.new_time).slice(0, 5) : null }])) };
              const nx = nextOf(withEx);
              const todayIso = iso(new Date());
              const moved = !!nx && (nx.slot.moved || Object.values(withEx.ex).some((e) => e.kind === 'move' && e.new_date >= todayIso));
              const ended = !nx;
              const nxDate = nx ? iso(nx.date) : '';
              const nxText = nx ? `${t(`day.short.${weekdayOf(nx.date)}`)} ${fmt(nxDate)} ${nx.slot.start_time}` : '';
              return (
              <div key={s.id} id={'slot-' + s.id}>
                <div className={'session' + (moved ? ' is-moved' : '') + (ended ? ' is-ended' : '')}>
                  <div className="session-time">
                    <b>{nx ? nx.slot.start_time : s.start_time}</b>
                    <span>{nx ? `${t(`day.short.${weekdayOf(nx.date)}`)} ${fmt(nxDate)}` : when(s)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="session-title">{s.title}</div>
                    <div className="muted small">{[t('common.minutes', { n: s.duration_min }), (studios.find((g) => g.id === s.studio_id) || {}).name, (classes.find((c) => c.id === s.class_id) || {}).name, s.pause_from && s.pause_to ? t('sa.pausedRange', { a: fmt(s.pause_from), b: fmt(s.pause_to) }) : null].filter(Boolean).join(' · ')}</div>
                    <div className="small session-status">{ended ? t('sa.ended') : `${moved ? t('sa.moved') + ' · ' : ''}${t('sa.next', { d: nxText })}`}</div>
                  </div>
                  <button type="button" className="icon-btn" aria-label={t('sa.edit')} aria-expanded={editId === s.id} onClick={() => setEditId(editId === s.id ? null : s.id)}>
                    <Icon name="edit" size={22} />
                  </button>
                  <button
                    type="button"
                    className={'icon-btn trash-btn' + (armed === 's' + s.id ? ' armed' : '')}
                    aria-label={t('sa.delete')}
                    onClick={() => confirm('s' + s.id, () => run(supabase.from('schedule_slots').delete().eq('id', s.id)))}
                  >
                    {armed === 's' + s.id ? <span className="small">{t('sa.deleteConfirm')}</span> : <Icon name="trash" size={22} />}
                  </button>
                </div>
                {editId === s.id && <SlotEditor key={s.id + (s.pause_from || '') + s.start_time + s.weekday} slot={s} exs={exs} run={run} t={t} />}
              </div>
              );
            })}
          </section>
        );
      })}
      {trainers.length > 0 && !slots.length && <p className="muted">{t('sa.empty')}</p>}
    </main>
  );
}
