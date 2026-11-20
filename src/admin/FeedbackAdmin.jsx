import { useCallback, useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../auth/index.jsx';
import { supabase } from '../lib/supabase.js';
import { ConfirmButton } from './ContentCommon.jsx';

// «Відгуки»: повідомлення учнів про помилки та ідеї. Нові зверху; можна позначити виконаним або видалити.
export default function FeedbackAdmin() {
  const { t, locale } = useI18n();
  const { ready, isAdmin } = useAuth();
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});
  const [photo, setPhoto] = useState({});
  const [filter, setFilter] = useState('new');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setRows(data || []);
    const ids = [...new Set((data || []).map((r) => r.user_id))];
    if (ids.length) {
      const { data: ps } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      setNames(Object.fromEntries((ps || []).map((p) => [p.id, p.full_name || p.email || ''])));
    }
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!ready) return <main className="page" />;
  if (!isAdmin) return <main className="page"><p className="muted">{t('students.noAccess')}</p></main>;

  const show = async (r) => {
    const { data, error } = await supabase.storage.from('feedback').createSignedUrl(r.photo_path, 600);
    if (error) return setErr(error.message);
    setPhoto((p) => ({ ...p, [r.id]: data.signedUrl }));
  };
  const setStatus = async (r, status) => {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', r.id);
    if (error) return setErr(error.message);
    load();
  };
  const remove = async (r) => {
    if (r.photo_path) await supabase.storage.from('feedback').remove([r.photo_path]);
    const { error } = await supabase.from('feedback').delete().eq('id', r.id);
    if (error) return setErr(error.message);
    load();
  };

  const list = (rows || []).filter((r) => filter === 'all' || r.status === filter);
  return (
    <main className="page">
      <TopBar title={t('fb.admin')} to="/profile" />
      <div className="chips">
        {['new', 'done', 'all'].map((f) => (
          <button key={f} type="button" className={'chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
            {t(`fb.f.${f}`)}
          </button>
        ))}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {rows && !list.length && <p className="muted">{t('fb.empty')}</p>}
      <div className="stack">
        {list.map((r) => (
          <div key={r.id} className="card stack">
            <div className="fb-head">
              <span className={'badge-draft fb-kind ' + r.kind}>{t(`fb.${r.kind}`)}</span>
              <span className="muted small">{names[r.user_id] || ''} · {new Date(r.created_at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            <p className="fb-text">{r.message}</p>
            {r.page && <p className="muted small">{r.page}</p>}
            {r.photo_path && (photo[r.id] ? <img className="fb-preview" src={photo[r.id]} alt="" /> : <button type="button" className="btn-ghost" onClick={() => show(r)}>{t('fb.showPhoto')}</button>)}
            <div className="fb-actions">
              <button type="button" className="btn-ghost" onClick={() => setStatus(r, r.status === 'new' ? 'done' : 'new')}>
                {r.status === 'new' ? t('fb.markDone') : t('fb.markNew')}
              </button>
              <ConfirmButton label={t('fb.delete')} confirmLabel={t('fb.deleteSure')} onConfirm={() => remove(r)} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
