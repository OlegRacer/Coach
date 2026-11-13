import { useCallback, useEffect, useState } from 'react';
import { MESSENGERS } from '../components/Onboarding.jsx';
import AccessPanel from './AccessPanel.jsx';
import { TrainerPicker, NotePanel } from './StudentExtra.jsx';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { avatarUrl } from '../lib/image.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { ConfirmButton } from './ContentCommon.jsx';

const NEW_DAYS = 7;
const IDLE_DAYS = 60; // не заходив стільки днів і не має чинного доступу → «неактивний'
const DAY = 864e5;

// Список зареєстрованих учнів для тренера. Нові реєстрації з'являються самі (Realtime).
export default function Students() {
  const { t, locale } = useI18n();
  const { ready, isAdmin } = useAuth();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerIds, setOwnerIds] = useState([]);
  const [armed, setArmed] = useState(null);
  const [accessRows, setAccessRows] = useState([]);
  const [exAccessRows, setExAccessRows] = useState([]);
  const [delErr, setDelErr] = useState(false);
  const [accessOpen, setAccessOpen] = useState(null);
  const [noteOpen, setNoteOpen] = useState(null);
  const [trainers, setTrainers] = useState([]);
  const [links, setLinks] = useState([]);
  const [notes, setNotes] = useState({});
  const [filter, setFilter] = useState('all');
  const [roleErr, setRoleErr] = useState(false);
  const [ownerErr, setOwnerErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, student_details(*)')
      .order('created_at', { ascending: false });
    if (error) setFailed(true);
    else {
      setFailed(false);
      setRows(data);
    }
    const acc = await supabase.from('section_access').select('student_id, section, expires_at');
    setAccessRows(acc.error ? [] : acc.data || []);
    const exa = await supabase.from('exercise_access').select('student_id, expires_at');
    setExAccessRows(exa.error ? [] : exa.data || []);
    const [tr, ln, nt] = await Promise.all([
      supabase.from('trainers').select('id, name').order('sort').order('created_at'),
      supabase.from('student_trainers').select('student_id, trainer_id'),
      supabase.from('student_notes').select('student_id, note')
    ]);
    setTrainers(tr.error ? [] : tr.data || []);
    setLinks(ln.error ? [] : ln.data || []);
    setNotes(nt.error ? {} : Object.fromEntries((nt.data || []).map((x) => [x.student_id, x.note])));
    const [own, ids] = await Promise.all([supabase.rpc('is_owner'), supabase.rpc('owner_ids')]);
    setOwnerErr(own.error ? `${own.error.code || ''} ${own.error.message || ''}`.trim() : '');
    setIsOwner(own.data === true);
    setOwnerIds(Array.isArray(ids.data) ? ids.data.map((x) => (typeof x === 'object' && x ? Object.values(x)[0] : x)) : []);
  }, []);

  const setRole = async (id, makeAdmin) => {
    const key = id + (makeAdmin ? ':on' : ':off');
    if (armed !== key) {
      setArmed(key);
      return;
    }
    setArmed(null);
    setRoleErr(false);
    const { error } = await supabase.rpc('set_admin_role', { target: id, make_admin: makeAdmin });
    if (error) setRoleErr(true);
    else load();
  };

  useEffect(() => {
    if (!isAdmin) return undefined;
    load();
    const channel = supabase
      .channel('profiles-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_details' }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, load]);

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—');
  const isNew = (iso) => Date.now() - new Date(iso).getTime() < NEW_DAYS * 86400000;

  const myTrainerIds = (sid) => links.filter((l) => l.student_id === sid).map((l) => l.trainer_id);
  const allStudents = (rows || []).filter((r) => r.role !== 'admin');
  const countFor = (f) =>
    f === 'all' ? allStudents.length : f === 'none' ? allStudents.filter((x) => !myTrainerIds(x.id).length).length : allStudents.filter((x) => myTrainerIds(x.id).includes(f)).length;
  // Неактивний: давно не заходив (або ніколи, відлік від реєстрації) і без чинного доступу.
  const hasActiveAccess = (id) =>
    [...accessRows, ...exAccessRows].some((r) => r.student_id === id && new Date(r.expires_at).getTime() > Date.now());
  const idleDays = (x) => Math.floor((Date.now() - new Date(x.last_seen_at || x.created_at).getTime()) / DAY);
  const isIdle = (x) => x.role !== 'admin' && idleDays(x) >= IDLE_DAYS && !hasActiveAccess(x.id);
  const idleList = allStudents.filter(isIdle);

  const removeFiles = async (x) => {
    try {
      const det = Array.isArray(x.student_details) ? x.student_details[0] : x.student_details;
      if (det && det.photo_path) await supabase.storage.from('avatars').remove([det.photo_path]);
      const { data } = await supabase.storage.from('payments').list(x.id, { limit: 1000 });
      if (data && data.length) await supabase.storage.from('payments').remove(data.map((f) => `${x.id}/${f.name}`));
    } catch {
      /* файли, що лишились, прибере сторінка «Пам'ять» */
    }
  };
  const deleteStudents = async (list) => {
    setDelErr(false);
    for (const x of list) {
      await removeFiles(x);
      const { error } = await supabase.rpc('delete_student', { p_id: x.id });
      if (error) setDelErr(true);
    }
    setOpen(null);
    load();
  };

  const students = allStudents.filter((x) =>
    filter === 'idle' ? isIdle(x) : filter === 'all' ? true : filter === 'none' ? !myTrainerIds(x.id).length : myTrainerIds(x.id).includes(filter)
  );
  const admins = (rows || []).filter((r) => r.role === 'admin');

  if (!ready) return <main className="page" />;

  if (!isAdmin) {
    return (
      <main className="page">
        <TopBar title={t('students.title')} />
        <p className="muted">{t('students.noAccess')}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <TopBar title={t('students.title')} />
      {(trainers.length > 0 || idleList.length > 0) && (
        <div className="chips filter-row" role="group" aria-label={t('students.trainers')}>
          {[{ id: 'all', name: t('students.filterAll') }, ...trainers, ...(trainers.length ? [{ id: 'none', name: t('students.filterNone') }] : []), ...(idleList.length ? [{ id: 'idle', name: t('students.filterIdle') }] : [])].map((x) => (
            <button type="button" key={x.id} className={'chip' + (filter === x.id ? ' active' : '')} aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>
              {x.name} · {x.id === 'idle' ? idleList.length : countFor(x.id)}
            </button>
          ))}
        </div>
      )}
      {filter === 'idle' && students.length > 0 && (
        <div className="card stack">
          <span className="muted small">{t('students.idleHint', { n: IDLE_DAYS })}</span>
          <ConfirmButton label={t('students.deleteAllIdle', { n: students.length })} confirmLabel={t('students.deleteConfirm')} onConfirm={() => deleteStudents(students)} />
        </div>
      )}
      {delErr && <p className="err" role="alert">{t('students.deleteError')}</p>}
      {failed && <p className="err">{t('auth.error')}</p>}
      {rows && !allStudents.length && <p className="muted">{t('students.empty')}</p>}
      {rows && allStudents.length > 0 && !students.length && <p className="muted">{t('students.filterEmpty')}</p>}
      {roleErr && <p className="err" role="alert">{t('students.roleError')}</p>}
      {ownerErr && <p className="muted small">{t('students.ownerSetup')} [{ownerErr}]</p>}
      <div className="list">
        {students.map((s) => {
          const raw = s.student_details;
          const det = Array.isArray(raw) ? raw[0] : raw;
          const filled = det && det.completed_at;
          const fullName = filled ? [det.first_name, det.last_name].filter(Boolean).join(' ') : '';
          const expanded = open === s.id;
          const msg = filled && det.contact_messenger ? MESSENGERS.find((m) => m.id === det.contact_messenger) : null;
          return (
            <div key={s.id} className={'student' + (expanded ? ' expanded' : '')}>
              <button type="button" className="student-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : s.id)}>
                <span className="avatar small-av" aria-hidden="true">
                  {(det && det.photo_path) || s.avatar_url ? <img src={det && det.photo_path ? avatarUrl(det.photo_path) : s.avatar_url} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={22} />}
                </span>
                <div className="student-main">
                  <div className="row">
                    <span className="list-title">{fullName || s.full_name || s.email}</span>
                    {isNew(s.created_at) && <span className="badge-new">{t('students.new')}</span>}
                    {isIdle(s) && <span className="badge-idle">{t('students.idleBadge', { n: idleDays(s) })}</span>}
                  </div>
                  <span className="muted small">
                    {s.provider}
                    {s.email ? ` · ${s.email}` : ''}
                  </span>
                  <span className="muted small">{t('students.registered', { date: fmt(s.created_at) })}</span>
                  <span className="muted small">{t('students.lastSeen', { date: fmt(s.last_seen_at) })}</span>
                  {myTrainerIds(s.id).length > 0 && (
                    <span className="small">{t('students.trainers')}: {trainers.filter((x) => myTrainerIds(s.id).includes(x.id)).map((x) => x.name).join(', ')}</span>
                  )}
                </div>
              </button>
              {expanded && isOwner && (
                <button
                  type="button"
                  className={'admin-btn' + (armed === s.id + ':on' ? ' armed' : '')}
                  aria-label={t('students.makeAdmin')}
                  title={t('students.makeAdmin')}
                  onClick={() => setRole(s.id, true)}
                >
                  <Icon name="shield" size={20} />
                </button>
              )}
              {expanded && (
                <div className="student-details">
                  {armed === s.id + ':on' && <p className="small warn">{t('students.makeAdminConfirm')}</p>}
                  {!filled && <p className="muted small">{t('students.noDetails')}</p>}
                  {filled && (
                    <>
                      {msg && det.contact_handle && (
                        <p className="small"><b>{t('students.contact')}:</b> {msg.label} · {det.contact_handle}</p>
                      )}
                      {det.gender && (
                        <p className="small"><b>{t('ob.gender.label')}:</b> {t(`ob.gender.${det.gender}`)}</p>
                      )}
                      {(det.height_cm || det.weight_kg || det.birth_year) && (
                        <p className="small"><b>{t('students.body')}:</b> {[det.height_cm && `${det.height_cm} cm`, det.weight_kg && `${det.weight_kg} kg`, det.birth_year && `${det.birth_year}`].filter(Boolean).join(' · ')}</p>
                      )}
                      {det.goals && det.goals.length > 0 && (
                        <p className="small"><b>{t('students.goals')}:</b> {det.goals.map((g) => t(`ob.goal.${g}`)).join(', ')}</p>
                      )}
                      {det.limitations && (
                        <p className="small"><b>{t('students.limitations')}:</b> {det.limitations}</p>
                      )}
                      <p className="muted small">{t('students.consent', { date: fmt(det.consent_at) })}</p>
                    </>
                  )}
                  <button type="button" className="btn-danger" onClick={() => setAccessOpen(accessOpen === s.id ? null : s.id)}>
                    {t('students.openAccess')}
                  </button>
                  {accessOpen === s.id && (
                    <AccessPanel student={s} rows={accessRows.filter((r) => r.student_id === s.id)} onChanged={load} />
                  )}
                  <TrainerPicker student={s} trainers={trainers} mine={myTrainerIds(s.id)} onChanged={load} />
                  <button type="button" className="btn-ghost" onClick={() => setNoteOpen(noteOpen === s.id ? null : s.id)}>
                    {t('students.note')}{notes[s.id] ? ' •' : ''}
                  </button>
                  {noteOpen === s.id && <NotePanel student={s} note={notes[s.id]} onChanged={load} />}
                  <ConfirmButton label={t('students.deleteAccount')} confirmLabel={t('students.deleteConfirm')} onConfirm={() => deleteStudents([s])} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {admins.length > 0 && (
        <>
          <h2 className="h2 section-title">{t('students.admins')}</h2>
          <div className="list">
            {admins.map((a) => {
              const owner = ownerIds.includes(a.id);
              return (
                <div key={a.id} className="student">
                  <div className="student-head" style={{ cursor: 'default' }}>
                    <span className="avatar small-av" aria-hidden="true">
                      {a.avatar_url ? <img src={a.avatar_url} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={22} />}
                    </span>
                    <div className="student-main">
                      <div className="row">
                        <span className="list-title">{a.full_name || a.email}</span>
                        <span className="badge-new">{owner ? t('students.owner') : t('students.adminBadge')}</span>
                      </div>
                      <span className="muted small">{a.email}</span>
                    </div>
                  </div>
                  {isOwner && !owner && (
                    <div className="student-details">
                      <button type="button" className="btn-ghost" onClick={() => setRole(a.id, false)}>
                        {armed === a.id + ':off' ? t('students.removeAdminConfirm') : t('students.removeAdmin')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
