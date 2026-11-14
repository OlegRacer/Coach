import { useCallback, useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

const blank = { studio_id: '', class_id: '', trainer_id: '', title: '', place: '', repeat: 'weekly', weekday: 1, on_date: '', start_time: '18:00', duration_min: 60 };

// Адмінка розкладу: тренери і заняття (щотижня або на дату).
export default function ScheduleAdmin() {
  const { t } = useI18n();
  const { ready, isAdmin } = useAuth();
  const [trainers, setTrainers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [studios, setStudios] = useState([]);
  const [classes, setClasses] = useState([]);
  const [newStudio, setNewStudio] = useState('');
  const [newClass, setNewClass] = useState({});
  const [newTrainer, setNewTrainer] = useState('');
  const [form, setForm] = useState(null);
  const [armed, setArmed] = useState(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const st = await supabase.from('studios').select('*').order('sort').order('created_at');
    setStudios(st.error ? [] : st.data || []);
    const cl = await supabase.from('studio_classes').select('*').order('sort').order('created_at');
    setClasses(cl.error ? [] : cl.data || []);
    const [tr, sl] = await Promise.all([
      supabase.from('trainers').select('*').order('sort').order('created_at'),
      supabase.from('schedule_slots').select('*').order('start_time')
    ]);
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

  const addStudio = async () => {
    const name = newStudio.trim();
    if (!name) return;
    if (await run(supabase.from('studios').insert({ name, sort: studios.length }))) setNewStudio('');
  };

  const addClass = async (studioId) => {
    const name = (newClass[studioId] || '').trim();
    if (!name) return;
    const n = classes.filter((c) => c.studio_id === studioId).length;
    if (await run(supabase.from('studio_classes').insert({ studio_id: studioId, name, sort: n }))) setNewClass({ ...newClass, [studioId]: '' });
  };

  const saveSlot = async () => {
    const f = form;
    const row = {
      trainer_id: f.trainer_id,
      title: f.title.trim() || ((classes.find((c) => c.id === f.class_id) || {}).name || ''),
      studio_id: f.studio_id || null,
      class_id: f.class_id || null,
      place: f.place.trim() || null,
      weekday: f.repeat === 'weekly' ? Number(f.weekday) : null,
      on_date: f.repeat === 'once' ? f.on_date : null,
      start_time: f.start_time,
      duration_min: Math.max(5, parseInt(f.duration_min, 10) || 60)
    };
    if (await run(supabase.from('schedule_slots').insert(row))) setForm(null);
  };
  const formOk = form && form.trainer_id && (form.title.trim() || form.class_id) && form.start_time && (form.repeat === 'weekly' || form.on_date);

  if (!ready) return <main className="page" />;
  if (!isAdmin) {
    return (
      <main className="page">
        <TopBar title={t('sa.title')} />
        <p className="muted">{t('students.noAccess')}</p>
      </main>
    );
  }

  const when = (s) => (s.weekday != null ? t(`day.short.${s.weekday}`) : s.on_date);

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
      <div className="list">
        {studios.map((x) => (
          <div key={x.id} className="stack">
            <div className="list-item">
              <input
                className="field"
                defaultValue={x.name}
                maxLength={120}
                aria-label={t('sa.studioName')}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== x.name) run(supabase.from('studios').update({ name: v }).eq('id', x.id));
                }}
              />
              <button
                type="button"
                className="btn-danger"
                style={{ width: 'auto', padding: '0 14px' }}
                onClick={() => confirm('g' + x.id, () => run(supabase.from('studios').delete().eq('id', x.id)))}
              >
                {armed === 'g' + x.id ? t('sa.deleteStudioConfirm') : t('sa.delete')}
              </button>
            </div>
            <div className="chips" style={{ paddingLeft: 12 }}>
              {classes.filter((c) => c.studio_id === x.id).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  className={'chip chip-sub' + (armed === 'c' + c.id ? ' active' : '')}
                  title={t('sa.delete')}
                  onClick={() => confirm('c' + c.id, () => run(supabase.from('studio_classes').delete().eq('id', c.id)))}
                >
                  {armed === 'c' + c.id ? t('sa.deleteClassConfirm', { name: c.name }) : c.name + ' ×'}
                </button>
              ))}
            </div>
            <div className="row" style={{ paddingLeft: 12 }}>
              <input className="field" value={newClass[x.id] || ''} maxLength={120} placeholder={t('sa.className')} onChange={(e) => setNewClass({ ...newClass, [x.id]: e.target.value })} />
              <button type="button" className="btn-ghost" style={{ width: 'auto', padding: '0 18px' }} disabled={!(newClass[x.id] || '').trim()} onClick={() => addClass(x.id)}>
                {t('sa.addClass')}
              </button>
            </div>
          </div>
        ))}
        <div className="row">
          <input className="field" value={newStudio} maxLength={120} placeholder={t('sa.studioName')} onChange={(e) => setNewStudio(e.target.value)} />
          <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0 18px' }} disabled={!newStudio.trim()} onClick={addStudio}>
            {t('sa.addStudio')}
          </button>
        </div>
      </div>

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
            <option value="">{t('sa.noStudio')}</option>
            {studios.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
          {form.studio_id && (
            <select className="field" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} aria-label={t('sa.class')}>
              <option value="">{t('sa.allClasses')}</option>
              {classes.filter((c) => c.studio_id === form.studio_id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <input className="field" value={form.title} maxLength={120} placeholder={t('sa.titleField')} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input className="field" value={form.place} maxLength={120} placeholder={t('sa.place')} onChange={(e) => setForm({ ...form, place: e.target.value })} />
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
            {mine.map((s) => (
              <div key={s.id} className="session">
                <div className="session-time">
                  <b>{s.start_time}</b>
                  <span>{when(s)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="session-title">{s.title}</div>
                  <div className="muted small">{[t('common.minutes', { n: s.duration_min }), (studios.find((g) => g.id === s.studio_id) || {}).name, (classes.find((c) => c.id === s.class_id) || {}).name, s.place].filter(Boolean).join(' · ')}</div>
                </div>
                <button
                  type="button"
                  className={'icon-btn trash-btn' + (armed === 's' + s.id ? ' armed' : '')}
                  aria-label={t('sa.delete')}
                  onClick={() => confirm('s' + s.id, () => run(supabase.from('schedule_slots').delete().eq('id', s.id)))}
                >
                  {armed === 's' + s.id ? <span className="small">{t('sa.deleteConfirm')}</span> : <Icon name="trash" size={22} />}
                </button>
              </div>
            ))}
          </section>
        );
      })}
      {trainers.length > 0 && !slots.length && <p className="muted">{t('sa.empty')}</p>}
    </main>
  );
}
