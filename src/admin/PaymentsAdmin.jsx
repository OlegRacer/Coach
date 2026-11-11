import { useCallback, useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL, mediaUrl } from '../lib/content.jsx';
import { formatMoney } from '../lib/money.js';
import { ConfirmButton, LangField } from './ContentCommon.jsx';

const errText = (e) => (e ? `${e.code || ''} ${e.message || ''}`.trim() : '');

// Адмінка оплат: заявки «Я оплатив», пакети доступу, реквізити для переказу.
export default function PaymentsAdmin() {
  const { t } = useI18n();
  const { ready, isAdmin } = useAuth();
  const [tab, setTab] = useState('requests');
  if (!ready) return <main className="page" />;
  if (!isAdmin) return <main className="page"><TopBar title={t('pay.admin')} /><p className="muted">{t('students.noAccess')}</p></main>;
  return (
    <main className="page">
      <TopBar title={t('pay.admin')} />
      <div className="chips">
        {['requests', 'plans', 'settings'].map((k) => (
          <button type="button" key={k} className={'chip' + (tab === k ? ' active' : '')} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {t(`pay.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'requests' && <Requests />}
      {tab === 'plans' && <Plans />}
      {tab === 'settings' && <Settings />}
    </main>
  );
}

function Requests() {
  const { t, locale } = useI18n();
  const L = useL();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState({});
  const [proof, setProof] = useState({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*, student:profiles!payment_requests_student_id_fkey(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) setErr(errText(error));
    setRows(data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const approve = async (id) => {
    const { error } = await supabase.rpc('approve_payment', { request_id: id });
    setErr(errText(error));
    load();
  };
  const reject = async (id) => {
    const { error } = await supabase.rpc('reject_payment', { request_id: id, reason: reason[id] || '' });
    setErr(errText(error));
    load();
  };
  const showProof = async (r) => {
    const { data, error } = await supabase.storage.from('payments').createSignedUrl(r.proof_path, 600);
    if (error) return setErr(errText(error));
    setProof((x) => ({ ...x, [r.id]: data.signedUrl }));
  };

  if (!rows) return <p className="muted">…</p>;
  const pending = rows.filter((r) => r.status === 'pending');
  const done = rows.filter((r) => r.status !== 'pending');
  const card = (r) => (
    <div key={r.id} className="card stack">
      <div className="row between">
        <b>{(r.student && (r.student.full_name || r.student.email)) || r.student_id}</b>
        <span className={'badge-status ' + r.status}>{t(`pay.status.${r.status}`)}</span>
      </div>
      <span className="muted small">
        {L(r.plan.title)} · {t('pay.days', { n: r.plan.days })} · {formatMoney(r.plan.price, r.plan.currency, locale)} · {new Date(r.created_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
      </span>
      {r.note && <p className="body pre">{r.note}</p>}
      {r.proof_path && (proof[r.id] ? <img className="pay-proof" src={proof[r.id]} alt="" /> : <button type="button" className="btn-ghost" onClick={() => showProof(r)}>{t('pay.showProof')}</button>)}
      {r.status === 'rejected' && r.reject_reason && <span className="muted small">{r.reject_reason}</span>}
      {r.status === 'pending' && (
        <>
          <input className="field" maxLength={500} placeholder={t('pay.rejectReason')} value={reason[r.id] || ''} onChange={(e) => setReason((x) => ({ ...x, [r.id]: e.target.value }))} />
          <button type="button" className="btn-primary" onClick={() => approve(r.id)}>{t('pay.approve')}</button>
          <ConfirmButton label={t('pay.reject')} onConfirm={() => reject(r.id)} />
        </>
      )}
    </div>
  );
  return (
    <div className="stack">
      {err && <p className="err" role="alert">{err}</p>}
      {!pending.length && <p className="muted">{t('pay.noPending')}</p>}
      {pending.map(card)}
      {done.length > 0 && <h2 className="h2 section-title">{t('pay.history')}</h2>}
      {done.map(card)}
    </div>
  );
}

const emptyPlan = () => ({ title: {}, description: {}, sections: [], days: '30', price: '', currency: 'TWD', active: false });

function Plans() {
  const { t, locale } = useI18n();
  const L = useL();
  const { rawSections } = useContent();
  const [plans, setPlans] = useState(null);
  const [edit, setEdit] = useState(null); // {id|null, ...поля}
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('access_plans').select('*').order('position').order('created_at');
    if (error) setErr(errText(error));
    setPlans(data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const days = parseInt(edit.days, 10);
    const price = parseFloat(String(edit.price).replace(',', '.'));
    if (!edit.sections.length || !(days > 0) || !(price >= 0)) return setErr(t('pay.planInvalid'));
    setBusy(true);
    setErr('');
    const row = { title: edit.title, description: edit.description, sections: edit.sections, days, price, currency: (edit.currency || 'TWD').toUpperCase().slice(0, 3), active: edit.active };
    const q = edit.id ? supabase.from('access_plans').update(row).eq('id', edit.id) : supabase.from('access_plans').insert({ ...row, position: (plans || []).length });
    const { error } = await q;
    setBusy(false);
    if (error) return setErr(errText(error));
    setEdit(null);
    load();
  };
  const del = async (id) => {
    const { error } = await supabase.from('access_plans').delete().eq('id', id);
    setErr(errText(error));
    setEdit(null);
    load();
  };
  const toggleSection = (id) =>
    setEdit((x) => ({ ...x, sections: x.sections.includes(id) ? x.sections.filter((s) => s !== id) : [...x.sections, id] }));

  if (!plans) return <p className="muted">…</p>;
  if (edit) {
    return (
      <section className="card stack">
        {err && <p className="err" role="alert">{err}</p>}
        <LangField label={t('content.fieldTitle')} value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} maxLength={80} />
        <LangField label={t('content.fieldDescription')} value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} multiline maxLength={500} />
        <span className="muted small">{t('pay.planSections')}</span>
        <div className="chips">
          {rawSections.map((s) => (
            <button type="button" key={s.id} className={'chip' + (edit.sections.includes(s.id) ? ' active' : '')} aria-pressed={edit.sections.includes(s.id)} onClick={() => toggleSection(s.id)}>
              {L(s.title) || s.id}
            </button>
          ))}
        </div>
        <div className="grid2">
          <label className="stack"><span className="muted small">{t('pay.planDays')}</span>
            <input className="field" inputMode="numeric" value={edit.days} onChange={(e) => setEdit({ ...edit, days: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="stack"><span className="muted small">{t('pay.planPrice')}</span>
            <input className="field" inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value.replace(/[^\d.,]/g, '') })} /></label>
          <label className="stack"><span className="muted small">{t('pay.planCurrency')}</span>
            <input className="field" maxLength={3} value={edit.currency} onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })} /></label>
        </div>
        <label className="access-row">
          <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
          <span>{t('pay.planActive')}<small>{edit.active ? t('pay.planActiveOn') : t('pay.planActiveOff')}</small></span>
        </label>
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>{t('content.save')}</button>
        <button type="button" className="btn-ghost" onClick={() => { setEdit(null); setErr(''); }}>{t('signin.cancel')}</button>
        {edit.id && <ConfirmButton label={t('pay.planDelete')} onConfirm={() => del(edit.id)} />}
      </section>
    );
  }
  return (
    <div className="stack">
      {err && <p className="err" role="alert">{err}</p>}
      <div className="list">
        {plans.map((p) => (
          <button type="button" key={p.id} className="list-item plan-row" onClick={() => setEdit({ ...p, days: String(p.days), price: String(p.price) })}>
            <span className="list-main">
              <span className="list-title">{L(p.title) || '—'}{!p.active && <span className="badge-draft">{t('content.draft')}</span>}</span>
              <span className="muted small">{t('pay.days', { n: p.days })} · {formatMoney(p.price, p.currency, locale)}</span>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary" onClick={() => setEdit(emptyPlan())}>{t('pay.addPlan')}</button>
    </div>
  );
}

function Settings() {
  const { t } = useI18n();
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) setErr(errText(error));
      setF(data || { line_id: '', qr_path: '', instructions: {} });
    });
  }, []);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `payment/qr-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('content').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    setBusy(false);
    if (error) return setErr(errText(error));
    setSaved(false);
    setF((x) => ({ ...x, qr_path: path }));
  };
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('payment_settings').upsert({ id: 1, line_id: f.line_id.trim(), qr_path: f.qr_path, instructions: f.instructions, updated_at: new Date().toISOString() });
    setBusy(false);
    setErr(errText(error));
    setSaved(!error);
  };
  if (!f) return <p className="muted">…</p>;
  return (
    <section className="card stack">
      {err && <p className="err" role="alert">{err}</p>}
      <label className="stack">
        <span className="muted small">LINE ID</span>
        <input className="field" maxLength={100} value={f.line_id} onChange={(e) => { setSaved(false); setF({ ...f, line_id: e.target.value }); }} />
      </label>
      <span className="muted small">{t('pay.qr')}</span>
      {f.qr_path && <img className="pay-qr" src={mediaUrl(f.qr_path)} alt="QR" />}
      <label className="btn-ghost file-btn">
        {busy ? t('content.uploading') : f.qr_path ? t('content.replaceFile') : t('content.uploadFile')}
        <input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={(e) => upload(e.target.files[0])} />
      </label>
      {f.qr_path && <button type="button" className="btn-ghost danger" onClick={() => { setSaved(false); setF({ ...f, qr_path: '' }); }}>{t('content.removeFile')}</button>}
      <LangField label={t('pay.instructions')} value={f.instructions} onChange={(v) => { setSaved(false); setF({ ...f, instructions: v }); }} multiline maxLength={1000} />
      <button type="button" className="btn-primary" disabled={busy} onClick={save}>{saved ? t('content.saved') : t('content.save')}</button>
    </section>
  );
}
