import { useEffect, useMemo, useState } from 'react';
import { DETAILS, displayName } from '../lib/names.js';
import TopBar from '../components/TopBar.jsx';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../auth/index.jsx';

const MODES = ['all', 'studios', 'classes', 'students'];

// Розсилка пуш-сповіщень: усім, студіям, класам або окремим учням.
export default function PushAdmin() {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState('all');
  const [ids, setIds] = useState([]);
  const [studios, setStudios] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('studios').select('id, name').order('sort').then(({ data }) => setStudios(data || []));
    supabase.from('studio_classes').select('id, name, studio_id').order('sort').then(({ data }) => setClasses(data || []));
    supabase.from('profiles').select('id, full_name, email, role, ' + DETAILS).order('full_name').then(({ data }) => setStudents((data || []).filter((p) => p.role !== 'admin')));
  }, [isAdmin]);

  // Скільки людей отримають: сервер рахує (dry-run), поки тренер обирає
  useEffect(() => {
    if (!isAdmin) return undefined;
    setCount(null);
    if (mode !== 'all' && !ids.length) return undefined;
    let alive = true;
    const id = setTimeout(async () => {
      const { data } = await supabase.functions.invoke('push', { body: { type: 'broadcast', mode, ids, dry: true } });
      if (alive && data && !data.error) setCount(data);
    }, 300);
    return () => { alive = false; clearTimeout(id); };
  }, [mode, ids, isAdmin]);

  const studioName = useMemo(() => Object.fromEntries(studios.map((s) => [s.id, s.name])), [studios]);
  const toggle = (id) => setIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const pickMode = (m) => { setMode(m); setIds([]); setRes(null); };
  const shown = students.filter((p) => !q || `${displayName(p)} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase()));

  const send = async () => {
    setErr('');
    setRes(null);
    if (!window.confirm(t('bc.confirm', { n: count ? count.reachable : 0 }))) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('push', { body: { type: 'broadcast', mode, ids, text } });
    setBusy(false);
    if (error || !data || data.error) return setErr(t('bc.fail') + (data && data.error ? ` (${data.error})` : ''));
    setRes(data);
    setText('');
  };

  if (!isAdmin) return <main className="page"><TopBar title={t('bc.title')} to="/profile" /></main>;
  const canSend = text.trim() && (mode === 'all' || ids.length) && count && count.reachable > 0 && !busy;

  return (
    <main className="page">
      <TopBar title={t('bc.title')} to="/profile" />
      <div className="bc-wrap">
        <span className="muted small">{t('bc.to')}</span>
        <div className="chips">
          {MODES.map((m) => (
            <button key={m} type="button" className={'chip' + (mode === m ? ' active' : '')} aria-pressed={mode === m} onClick={() => pickMode(m)}>
              {t('bc.mode.' + m)}
            </button>
          ))}
        </div>

        {mode === 'studios' && (
          <div className="also-list">
            {studios.map((s) => (
              <label key={s.id} className={'also-row' + (ids.includes(s.id) ? ' on' : '')}>
                <input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} />
                <span>{s.name}</span>
              </label>
            ))}
            {!studios.length && <span className="muted small">{t('bc.none')}</span>}
          </div>
        )}
        {mode === 'classes' && (
          <div className="also-list">
            {classes.map((c) => (
              <label key={c.id} className={'also-row' + (ids.includes(c.id) ? ' on' : '')}>
                <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} />
                <span>{studioName[c.studio_id] ? `${studioName[c.studio_id]} › ` : ''}{c.name}</span>
              </label>
            ))}
            {!classes.length && <span className="muted small">{t('bc.none')}</span>}
          </div>
        )}
        {mode === 'students' && (
          <>
            <input className="field" type="search" placeholder={t('aud.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="also-list">
              {shown.map((p) => (
                <label key={p.id} className={'also-row' + (ids.includes(p.id) ? ' on' : '')}>
                  <input type="checkbox" checked={ids.includes(p.id)} onChange={() => toggle(p.id)} />
                  <span>{displayName(p)}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <span className="muted small">{t('bc.text')}</span>
        <textarea className="field" rows={4} maxLength={300} value={text} placeholder={t('bc.textPh')} onChange={(e) => setText(e.target.value)} />
        <span className="muted small">{text.length}/300</span>

        <p className="small bc-count">
          {count ? t('bc.count', { r: count.reachable, n: count.recipients }) : (mode !== 'all' && !ids.length ? t('bc.pick') : t('admin.loading'))}
        </p>
        <button type="button" className="btn-primary" disabled={!canSend} onClick={send}>
          {busy ? t('bc.sending') : t('bc.send')}
        </button>
        {res && <p className="small bc-ok">{t('bc.done', { s: res.sent, r: res.reachable })}</p>}
        {err && <p className="small bc-err">{err}</p>}
        <p className="muted small">{t('bc.note')}</p>
      </div>
    </main>
  );
}
