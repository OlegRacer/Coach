import { useCallback, useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

const blank = { trainer_id: '', title: '', place: '', repeat: 'weekly', weekday: 1, on_date: '', start_time: '18:00', duration_min: 60 };

// Адмінка розкладу: тренери, заняття (щотижня або на дату) і запис учнів на заняття.
export default function ScheduleAdmin() {
  const { t } = useI18n();
  const { ready, isAdmin } = useAuth();
  const [trainers, setTrainers] = useState([]);
  const [slots, setSlots] = useState([]);
  const [enrol, setEnrol] = useState([]);
  const [students, setStudents] = useState([]);
  const [newTrainer, setNewTrainer] = useState('');
  const [form, setForm] = useState(null);
  const [openSlot, setOpenSlot] = useState(null);
  const [armed, setArmed] = useState(null);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    const [tr, sl, en, st] = await Promise.all([
      supabase.from('trainers').select('*').order('sort').order('created_at'),
      supabase.from('schedule_slots').select('*').order('start_time'),
      supabase.from('slot_students').select('slot_id, student_id'),
      supabase.from('profiles').select('id, full_name, email, role').neq('role', 'admin').order('created_at')
    ]);
    if (tr.error || sl.error) {
      setErr(true);
      return;
    }
    setTrainers(tr.data || []);
    setSlots((sl.data || []).map((s) => ({ ...s, start_time: String(s.start_time).slice(0, 5) })));
    setEnrol(en.data || []);
    setStudents(st.data || []);
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
    const row = {
      trainer_id: f.trainer_id,
      title: f.title.trim(),
      place: f.place.trim() || null,
      weekday: f.repeat === 'weekly' ? Number(f.weekday) : null,
      on_date: f.repeat === 'once' ? f.on_date : null,
      start_time: f.start_time,
      duration_min: Math.max(5, parseInt(f.duration_min, 10) || 60)
    };
    if (await run(supabase.from('schedule_slots').insert(row))) setForm(null);
  };
  const formOk = form && form.trainer_id && form.title.trim() && form.start_time && (form.repeat === 'weekly' || form.on_date);

  const toggleStudent = (slotId, studentId, on) =>
    run(
      on
        ? supabase.from('slot_students').delete().eq('slot_id', slotId).eq('student_id', studentId)
        : supabase.from('slot_students').insert({ slot_id: slotId, student_id: studentId })
    );

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
  const nameOf = (st) => st.full_name || st.email;

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
            {mine.map((s) => {
              const ids = enrol.filter((e) => e.slot_id === s.id).map((e) => e.student_id);
              return (
                <div key={s.id} className="stack" style={{ gap: 10 }}>
                  <div className="session">
                    <div className="session-time">
                      <b>{s.start_time}</b>
                      <span>{when(s)}</span>
                    </div>
                    <div>
                      <div className="session-title">{s.title}</div>
                      <div className="muted small">{[t('common.minutes', { n: s.duration_min }), s.place].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                  <div className="row">
                    <button type="button" className="btn-ghost" onClick={() => setOpenSlot(openSlot === s.id ? null : s.id)}>
                      {t('sa.students')} ({ids.length})
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => confirm('s' + s.id, () => run(supabase.from('schedule_slots').delete().eq('id', s.id)))}
                    >
                      {armed === 's' + s.id ? t('sa.deleteConfirm') : t('sa.delete')}
                    </button>
                  </div>
                  {openSlot === s.id && (
                    <div className="access-panel">
                      {!students.length && <p className="muted small">{t('sa.noStudents')}</p>}
                      {students.map((st) => {
                        const on = ids.includes(st.id);
                        return (
                          <label key={st.id} className="access-row">
                            <input type="checkbox" checked={on} onChange={() => toggleStudent(s.id, st.id, on)} />
                            <span>{nameOf(st)}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
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
