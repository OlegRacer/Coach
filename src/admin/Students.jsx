import { useCallback, useEffect, useState } from 'react';
import { MESSENGERS } from '../components/Onboarding.jsx';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

const NEW_DAYS = 7;

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
  const [roleErr, setRoleErr] = useState(false);

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
    const [own, ids] = await Promise.all([supabase.rpc('is_owner'), supabase.rpc('owner_ids')]);
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

  const students = (rows || []).filter((r) => r.role !== 'admin');
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
      {failed && <p className="err">{t('auth.error')}</p>}
      {rows && !students.length && <p className="muted">{t('students.empty')}</p>}
      {roleErr && <p className="err" role="alert">{t('students.roleError')}</p>}
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
                  {s.avatar_url ? <img src={s.avatar_url} alt="" referrerPolicy="no-referrer" /> : <Icon name="user" size={22} />}
                </span>
                <div className="student-main">
                  <div className="row">
                    <span className="list-title">{fullName || s.full_name || s.email}</span>
                    {isNew(s.created_at) && <span className="badge-new">{t('students.new')}</span>}
                  </div>
                  <span className="muted small">
                    {s.provider}
                    {s.email ? ` · ${s.email}` : ''}
                  </span>
                  <span className="muted small">{t('students.registered', { date: fmt(s.created_at) })}</span>
                  <span className="muted small">{t('students.lastSeen', { date: fmt(s.last_seen_at) })}</span>
                </div>
              </button>
              {expanded && (
                <div className="student-details">
                  {!filled && <p className="muted small">{t('students.noDetails')}</p>}
                  {filled && (
                    <>
                      {msg && det.contact_handle && (
                        <p className="small"><b>{t('students.contact')}:</b> {msg.label} · {det.contact_handle}</p>
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
                  {isOwner && (
                    <button type="button" className="btn-ghost" onClick={() => setRole(s.id, true)}>
                      {armed === s.id + ':on' ? t('students.makeAdminConfirm') : t('students.makeAdmin')}
                    </button>
                  )}
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
