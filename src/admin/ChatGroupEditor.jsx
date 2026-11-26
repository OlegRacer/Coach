import { useEffect, useMemo, useState } from 'react';
import { DETAILS, displayName } from '../lib/names.js';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

const MODES = ['studios', 'classes', 'students'];

// Створення й редагування групи: учасників додаємо за студією, класом або вручну.
export default function ChatGroupEditor() {
  const { gid } = useParams();
  const isNew = !gid;
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [write, setWrite] = useState(true);
  const [members, setMembers] = useState([]); // id учнів
  const [orig, setOrig] = useState([]);
  const [studios, setStudios] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [known, setKnown] = useState({}); // імена учасників, відомі з бази групи
  const [mode, setMode] = useState('studios');
  const [pick, setPick] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('studios').select('id, name').order('sort').then(({ data }) => setStudios(data || []));
    supabase.from('studio_classes').select('id, name, studio_id').order('sort').then(({ data }) => setClasses(data || []));
    supabase.from('profiles').select('id, full_name, email, role, ' + DETAILS).order('full_name').then(({ data }) => setStudents(Array.isArray(data) ? data.filter((p) => p.role !== 'admin') : []));
    if (gid) {
      supabase.from('chat_groups').select('title, students_can_write').eq('id', gid).maybeSingle().then(({ data }) => {
        if (data) { setTitle(data.title); setWrite(data.students_can_write); }
      });
      supabase.rpc('chat_group_members_get', { p_group: gid }).then(({ data }) => {
        const ids = (data || []).map((r) => r.student_id);
        setKnown(Object.fromEntries((data || []).map((r) => [r.student_id, r.full_name || r.email])));
        setMembers(ids);
        setOrig(ids);
      });
    }
  }, [isAdmin, gid]);

  const nameOf = useMemo(() => ({ ...known, ...Object.fromEntries(students.map((s) => [s.id, displayName(s)])) }), [students, known]);
  const studioName = useMemo(() => Object.fromEntries(studios.map((s) => [s.id, s.name])), [studios]);
  const togglePick = (id) => setPick((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const setM = (m) => { setMode(m); setPick([]); };

  // Додати вибрані студії/класи/учнів: перетворюємо на конкретних учнів
  const addPicked = async () => {
    let ids = [];
    if (mode === 'students') ids = pick;
    else {
      const table = mode === 'studios' ? 'student_studios' : 'student_classes';
      const col = mode === 'studios' ? 'studio_id' : 'class_id';
      const { data } = await supabase.from(table).select('student_id').in(col, pick);
      ids = (data || []).map((r) => r.student_id);
    }
    setMembers((a) => [...new Set([...a, ...ids])]);
    setPick([]);
  };

  const save = async () => {
    setErr('');
    if (!title.trim()) return setErr(t('chat.titleRequired'));
    setBusy(true);
    try {
      let id = gid;
      if (isNew) {
        const { data, error } = await supabase.rpc('chat_group_create', { p_title: title, p_students: members });
        if (error) throw error;
        id = data;
        if (!write) await supabase.rpc('chat_group_update', { p_id: id, p_title: title, p_write: false });
      } else {
        await supabase.rpc('chat_group_update', { p_id: gid, p_title: title, p_write: write });
        const add = members.filter((x) => !orig.includes(x));
        const del = orig.filter((x) => !members.includes(x));
        if (add.length) await supabase.rpc('chat_group_add', { p_group: gid, p_students: add });
        for (const sid of del) await supabase.rpc('chat_group_remove', { p_group: gid, p_student: sid });
      }
      nav(`/admin/chat/g/${id}`, { replace: true });
    } catch (e) {
      setErr(e.message || String(e));
    }
    setBusy(false);
  };
  const del = async () => {
    if (!window.confirm(t('chat.deleteGroupConfirm'))) return;
    await supabase.rpc('chat_group_delete', { p_id: gid });
    nav('/admin/chat', { replace: true });
  };

  if (!isAdmin) return null;
  const shown = students.filter((p) => !q || `${displayName(p)} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <main className="page">
      <TopBar title={isNew ? t('chat.newGroup') : t('chat.groupSettings')} to={isNew ? '/admin/chat' : `/admin/chat/g/${gid}`} />
      <div className="bc-wrap" style={{ paddingInline: 16 }}>
        <span className="muted small">{t('chat.groupName')}</span>
        <input className="field" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        <label className="also-row">
          <input type="checkbox" checked={!write} onChange={(e) => setWrite(!e.target.checked)} />
          <span>{t('chat.onlyCoach')}</span>
        </label>

        <span className="muted small">{t('chat.members', { n: members.length })}</span>
        <div className="also-list">
          {members.map((id) => (
            <label key={id} className="also-row on">
              <input type="checkbox" checked onChange={() => setMembers((a) => a.filter((x) => x !== id))} />
              <span>{nameOf[id] || id}</span>
            </label>
          ))}
          {!members.length && <span className="muted small">{t('chat.noMembers')}</span>}
        </div>

        <span className="muted small">{t('chat.addMembers')}</span>
        <div className="chips">
          {MODES.map((m) => (
            <button key={m} type="button" className={'chip' + (mode === m ? ' active' : '')} aria-pressed={mode === m} onClick={() => setM(m)}>{t('bc.mode.' + m)}</button>
          ))}
        </div>
        {mode === 'studios' && (
          <div className="also-list">
            {studios.map((s) => (
              <label key={s.id} className={'also-row' + (pick.includes(s.id) ? ' on' : '')}>
                <input type="checkbox" checked={pick.includes(s.id)} onChange={() => togglePick(s.id)} /><span>{s.name}</span>
              </label>
            ))}
          </div>
        )}
        {mode === 'classes' && (
          <div className="also-list">
            {classes.map((c) => (
              <label key={c.id} className={'also-row' + (pick.includes(c.id) ? ' on' : '')}>
                <input type="checkbox" checked={pick.includes(c.id)} onChange={() => togglePick(c.id)} />
                <span>{studioName[c.studio_id] ? `${studioName[c.studio_id]} › ` : ''}{c.name}</span>
              </label>
            ))}
          </div>
        )}
        {mode === 'students' && (
          <>
            <input className="field" type="search" placeholder={t('aud.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="also-list">
              {shown.map((p) => (
                <label key={p.id} className={'also-row' + (pick.includes(p.id) ? ' on' : '')}>
                  <input type="checkbox" checked={pick.includes(p.id)} onChange={() => togglePick(p.id)} /><span>{displayName(p)}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <button type="button" className="btn-ghost" disabled={!pick.length} onClick={addPicked}>{t('chat.addPicked')}</button>
        <p className="muted small">{t('chat.syncNote')}</p>

        {err && <p className="small bc-err">{err}</p>}
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>{t('chat.save')}</button>
        {!isNew && <button type="button" className="btn-ghost" onClick={del}>{t('chat.deleteGroup')}</button>}
      </div>
    </main>
  );
}
