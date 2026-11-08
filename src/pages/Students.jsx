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

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, student_details(*)')
      .neq('role', 'admin')
      .order('created_at', { ascending: false });
    if (error) setFailed(true);
    else {
      setFailed(false);
      setRows(data);
    }
  }, []);

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
      {rows && !rows.length && <p className="muted">{t('students.empty')}</p>}
      <div className="list">
        {(rows || []).map((s) => {
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
                      {det.goals && det.goals.length > 0 && (
                        <p className="small"><b>{t('students.goals')}:</b> {det.goals.map((g) => t(`ob.goal.${g}`)).join(', ')}</p>
                      )}
                      {det.limitations && (
                        <p className="small"><b>{t('students.limitations')}:</b> {det.limitations}</p>
                      )}
                      <p className="muted small">{t('students.consent', { date: fmt(det.consent_at) })}</p>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
