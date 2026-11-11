import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import useOnline from '../lib/useOnline.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL, mediaUrl } from '../lib/content.jsx';
import { formatMoney } from '../lib/money.js';

// Доступ і оплата: учень обирає пакет, платить переказом (LINE Pay) і натискає «Я оплатив».
// Тренер підтверджує заявку в адмінці, і доступ відкривається автоматично.
export default function Plans() {
  const { t, locale } = useI18n();
  const L = useL();
  const online = useOnline();
  const { ready, user } = useAuth();
  const { section } = useContent();
  const [plans, setPlans] = useState(null);
  const [settings, setSettings] = useState(null);
  const [requests, setRequests] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [p, s, r] = await Promise.all([
      supabase.from('access_plans').select('*').eq('active', true).order('position').order('created_at'),
      supabase.from('payment_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('payment_requests').select('*').eq('student_id', user.id).order('created_at', { ascending: false }).limit(20)
    ]);
    setPlans(p.error ? [] : p.data || []);
    setSettings(s.error ? null : s.data);
    setRequests(r.error ? [] : r.data || []);
  }, [user]);

  useEffect(() => {
    if (online) load();
  }, [online, load]);

  if (!ready) return <main className="page" />;
  if (!user) {
    return (
      <main className="page">
        <TopBar title={t('pay.title')} />
        <div className="card locked">
          <span className="ob-icon"><Icon name="lock" size={30} /></span>
          <p className="body">{t('access.signin')}</p>
          <Link to="/" className="btn-primary">{t('pay.toHome')}</Link>
        </div>
      </main>
    );
  }
  if (!online) {
    return (
      <main className="page">
        <TopBar title={t('pay.title')} />
        <p className="muted">{t('auth.needOnline')}</p>
      </main>
    );
  }

  const sectionNames = (ids) => (ids || []).map((id) => section(id)).filter(Boolean).map((s) => L(s.title)).join(', ');

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const submit = async () => {
    setBusy(true);
    setErr('');
    let proof = '';
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      proof = `${user.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from('payments').upload(proof, file, { contentType: file.type });
      if (up.error) {
        setBusy(false);
        setErr(`${up.error.message}`);
        return;
      }
    }
    const { error } = await supabase.from('payment_requests').insert({
      student_id: user.id,
      plan_id: chosen.id,
      plan: { title: chosen.title, sections: chosen.sections, days: chosen.days, price: chosen.price, currency: chosen.currency },
      note: note.trim(),
      proof_path: proof
    });
    setBusy(false);
    if (error) return setErr(`${error.code || ''} ${error.message || ''}`.trim());
    setSent(true);
    setChosen(null);
    setNote('');
    setFile(null);
    load();
  };

  const status = (s) => t(`pay.status.${s}`);
  const hasPending = requests.some((r) => r.status === 'pending');

  return (
    <main className="page">
      <TopBar title={t('pay.title')} />
      {sent && (
        <div className="card pay-sent" role="status">
          <Icon name="check" size={22} />
          <span>{t('pay.sent')}</span>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}

      {!chosen && (
        <>
          <p className="muted small">{t('pay.intro')}</p>
          {plans && !plans.length && <p className="muted">{t('pay.noPlans')}</p>}
          <div className="stack">
            {(plans || []).map((p) => (
              <button type="button" key={p.id} className="card plan-card" onClick={() => { setChosen(p); setSent(false); }}>
                <span className="plan-top">
                  <b className="plan-title">{L(p.title)}</b>
                  <span className="plan-price">{formatMoney(p.price, p.currency, locale)}</span>
                </span>
                <span className="muted small">{t('pay.days', { n: p.days })} · {sectionNames(p.sections)}</span>
                {L(p.description) && <span className="body">{L(p.description)}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {chosen && (
        <section className="card stack">
          <button type="button" className="link-btn back-link" onClick={() => setChosen(null)}>
            ← {t('pay.otherPlan')}
          </button>
          <h2 className="h2">{L(chosen.title)}</h2>
          <p className="muted small">{t('pay.days', { n: chosen.days })} · {sectionNames(chosen.sections)}</p>
          <p className="pay-amount">{formatMoney(chosen.price, chosen.currency, locale)}</p>

          <h3 className="h3">{t('pay.step1')}</h3>
          {settings && settings.line_id ? (
            <div className="pay-id">
              <span className="muted small">LINE ID</span>
              <b>{settings.line_id}</b>
              <button type="button" className="btn-ghost" onClick={() => copy(settings.line_id)}>
                {copied ? t('pay.copied') : t('pay.copy')}
              </button>
            </div>
          ) : (
            <p className="muted small">{t('pay.noDetails')}</p>
          )}
          {settings && settings.qr_path && <img className="pay-qr" src={mediaUrl(settings.qr_path)} alt="QR" />}
          {settings && L(settings.instructions) && <p className="body pre">{L(settings.instructions)}</p>}
          <p className="muted small">{t('pay.nameHint')}</p>

          <h3 className="h3">{t('pay.step2')}</h3>
          <textarea className="field" rows={3} maxLength={1000} value={note} placeholder={t('pay.notePlaceholder')} onChange={(e) => setNote(e.target.value)} />
          <label className="btn-ghost file-btn">
            {file ? file.name : t('pay.attach')}
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
          <button type="button" className="btn-primary" disabled={busy} onClick={submit}>
            {busy ? t('pay.sending') : t('pay.paid')}
          </button>
          {hasPending && <p className="muted small">{t('pay.hasPending')}</p>}
        </section>
      )}

      {requests.length > 0 && (
        <>
          <h2 className="h2 section-title">{t('pay.history')}</h2>
          <div className="list">
            {requests.map((r) => (
              <div key={r.id} className="list-item">
                <div className="list-main">
                  <span className="list-title">{L(r.plan.title)}</span>
                  <span className="muted small">
                    {new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · {formatMoney(r.plan.price, r.plan.currency, locale)}
                    {r.status === 'rejected' && r.reject_reason ? ` · ${r.reject_reason}` : ''}
                  </span>
                </div>
                <span className={'badge-status ' + r.status}>{status(r.status)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
