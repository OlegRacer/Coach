import { useCallback, useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { ConfirmButton } from './ContentCommon.jsx';

const MB = 1024 * 1024;
const PLANS = { free: { db: 500 * MB, files: 1024 * MB }, pro: { db: 8192 * MB, files: 100 * 1024 * MB } };
const BUCKETS = ['payments', 'content', 'avatars'];
const errText = (e) => (e ? `${e.code || ''} ${e.message || ''}`.trim() : '');
const size = (b) => (b >= 1024 * MB ? (b / 1024 / MB).toFixed(2) + ' GB' : b >= MB ? (b / MB).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB');

function Bar({ label, used, max, extra }) {
  const pct = Math.min(100, (used / max) * 100);
  return (
    <div className="stack">
      <div className="row between">
        <b>{label}</b>
        <span className="muted small">{size(used)} / {size(max)}{extra ? ' · ' + extra : ''}</span>
      </div>
      <div className="mem-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={'mem-fill' + (pct > 85 ? ' hot' : '')} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

// Керування пам'яттю: скільки займає база й файли, видалення зайвого.
export default function StorageAdmin() {
  const { t, locale } = useI18n();
  const { ready, isAdmin } = useAuth();
  const [plan, setPlan] = useState(() => {
    try { return localStorage.getItem('mem-plan') === 'pro' ? 'pro' : 'free'; } catch { return 'free'; }
  });
  const [usage, setUsage] = useState(null);
  const [orphans, setOrphans] = useState(null);
  const [files, setFiles] = useState(null); // {bucket, rows}
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    const u = await supabase.rpc('storage_usage');
    if (u.error) return setErr(errText(u.error));
    setUsage(u.data);
    const o = await supabase.rpc('storage_orphans');
    if (o.error) setErr(errText(o.error));
    else setOrphans(o.data || []);
  }, []);
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const pickPlan = (p) => {
    setPlan(p);
    try { localStorage.setItem('mem-plan', p); } catch { /* ignore */ }
  };

  // Видалення лише через Storage API (прямі DELETE з storage.objects лишили б файли «сиротами»).
  const removeFiles = async (bucket, names) => {
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await supabase.storage.from(bucket).remove(names.slice(i, i + 100));
      if (error) return setErr(errText(error));
    }
    setErr('');
  };
  const cleanOrphans = async () => {
    const by = {};
    orphans.forEach((o) => (by[o.bucket] = [...(by[o.bucket] || []), o.name]));
    for (const b of Object.keys(by)) await removeFiles(b, by[b]);
    setInfo(t('mem.cleaned', { n: orphans.length }));
    load();
  };
  // Скріншоти вже вирішених оплат: файл геть, запис лишається.
  const cleanProofs = async () => {
    const { data, error } = await supabase.from('payment_requests').select('id, proof_path').neq('status', 'pending').neq('proof_path', '');
    if (error) return setErr(errText(error));
    const rows = data || [];
    await removeFiles('payments', rows.map((r) => r.proof_path));
    for (const r of rows) await supabase.from('payment_requests').update({ proof_path: '' }).eq('id', r.id);
    setInfo(t('mem.cleaned', { n: rows.length }));
    load();
  };
  // Старі вирішені оплати повністю (файл і запис).
  const cleanOld = async () => {
    const cut = new Date(Date.now() - 90 * 864e5).toISOString();
    const { data, error } = await supabase.from('payment_requests').select('id, proof_path').neq('status', 'pending').lt('created_at', cut);
    if (error) return setErr(errText(error));
    const rows = data || [];
    await removeFiles('payments', rows.filter((r) => r.proof_path).map((r) => r.proof_path));
    for (const r of rows) await supabase.from('payment_requests').delete().eq('id', r.id);
    setInfo(t('mem.cleaned', { n: rows.length }));
    load();
  };
  const openBucket = async (b) => {
    if (files && files.bucket === b) return setFiles(null);
    const { data, error } = await supabase.rpc('storage_files', { bucket: b });
    if (error) return setErr(errText(error));
    setFiles({ bucket: b, rows: data || [] });
  };
  const delFile = async (b, name) => {
    await removeFiles(b, [name]);
    setFiles((f) => f && { ...f, rows: f.rows.filter((r) => r.name !== name) });
    load();
  };

  if (!ready) return <main className="page" />;
  if (!isAdmin) return <main className="page"><TopBar title={t('mem.title')} /><p className="muted">{t('students.noAccess')}</p></main>;
  const lim = PLANS[plan];
  const bk = (usage && usage.buckets) || {};
  const filesUsed = Object.values(bk).reduce((a, b) => a + (b.bytes || 0), 0);
  const orphanBytes = (orphans || []).reduce((a, o) => a + (o.size || 0), 0);

  return (
    <main className="page">
      <TopBar title={t('mem.title')} />
      <div className="stack">
        {err && <p className="err" role="alert">{err}</p>}
        {info && <p className="muted small" role="status">{info}</p>}
        <div className="chips">
          {['free', 'pro'].map((p) => (
            <button type="button" key={p} className={'chip' + (plan === p ? ' active' : '')} aria-pressed={plan === p} onClick={() => pickPlan(p)}>
              {p === 'free' ? 'Free' : 'Pro'}
            </button>
          ))}
        </div>
        {!usage ? <p className="muted">…</p> : (
          <>
            <div className="card stack">
              <Bar label={t('mem.db')} used={usage.db_bytes} max={lim.db} />
              <Bar label={t('mem.files')} used={filesUsed} max={lim.files} />
            </div>
            <h2 className="h2 section-title">{t('mem.buckets')}</h2>
            {BUCKETS.map((b) => (
              <div key={b} className="card stack">
                <button type="button" className="row between btn-plain" onClick={() => openBucket(b)} aria-expanded={!!files && files.bucket === b}>
                  <b>{t(`mem.bucket.${b}`)}</b>
                  <span className="muted small">{(bk[b] && bk[b].files) || 0} · {size((bk[b] && bk[b].bytes) || 0)}</span>
                </button>
                {files && files.bucket === b && (
                  <ul className="mem-files">
                    {!files.rows.length && <li className="muted small">{t('mem.empty')}</li>}
                    {files.rows.map((f) => (
                      <li key={f.name} className="row between">
                        <span className="small mem-name">{f.name}<br /><span className="muted">{size(f.size)} · {new Date(f.created_at).toLocaleDateString(locale)}</span></span>
                        <ConfirmButton label={t('mem.delete')} confirmLabel={t('pay.delConfirm')} onConfirm={() => delFile(b, f.name)} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <h2 className="h2 section-title">{t('mem.cleanup')}</h2>
            <div className="card stack">
              <span className="muted small">{t('mem.orphansHint')}</span>
              <ConfirmButton
                label={t('mem.orphans', { n: orphans ? orphans.length : 0, size: size(orphanBytes) })}
                confirmLabel={t('pay.delConfirm')}
                onConfirm={cleanOrphans}
              />
            </div>
            <div className="card stack">
              <span className="muted small">{t('mem.proofsHint')}</span>
              <ConfirmButton label={t('mem.proofs')} confirmLabel={t('pay.delConfirm')} onConfirm={cleanProofs} />
            </div>
            <div className="card stack">
              <span className="muted small">{t('mem.oldHint')}</span>
              <ConfirmButton label={t('mem.old')} confirmLabel={t('pay.delConfirm')} onConfirm={cleanOld} />
            </div>
            <h2 className="h2 section-title">{t('mem.rows')}</h2>
            <div className="card stack">
              {Object.entries(usage.rows || {}).map(([k, v]) => (
                <div key={k} className="row between"><span>{k}</span><b>{v}</b></div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
