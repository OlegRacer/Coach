import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/index.jsx';
import { useL } from '../lib/content.jsx';
import { formatMoney } from '../lib/money.js';
import { itemDate, lastDate } from '../lib/challenges.js';
import { iso } from '../lib/schedule.js';
import { ConfirmButton } from '../admin/ContentCommon.jsx';

const fmt = (d, locale) => new Date(`${d}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

// Челенджі учня: «Приєднатись» (безкоштовний), «Купити» (платний), «Додати» (повернутись у вже оплачений/колишній).
// Заняття автоматично потрапляють у «Мій розклад».
export default function ChallengesBlock({ challenges, items, members, done, requests, onBuy, reload }) {
  const { t, locale } = useI18n();
  const L = useL();
  const [open, setOpen] = useState(null);
  const [start, setStart] = useState(iso(new Date()));
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  if (!challenges || !challenges.length) return null;

  const join = async (c) => {
    setBusy(c.id);
    setErr('');
    const { error } = await supabase.rpc('join_challenge', { p_challenge: c.id, p_start: c.mode === 'flex' ? start : null });
    setBusy('');
    if (error) return setErr(`${error.code || ''} ${error.message || ''}`.trim());
    window.dispatchEvent(new Event('schedule:changed'));
    reload();
  };
  const leave = async (c) => {
    await supabase.rpc('leave_challenge', { p_challenge: c.id });
    window.dispatchEvent(new Event('schedule:changed'));
    reload();
  };

  return (
    <section className="stack">
      <h2 className="h2 section-title">{t('chal.title')}</h2>
      {err && <p className="err" role="alert">{err}</p>}
      {challenges.map((c) => {
        const list = items.filter((i) => i.challenge_id === c.id);
        const m = members.find((x) => x.challenge_id === c.id);
        const active = m && m.status === 'active';
        const pending = requests.some((r) => r.status === 'pending' && r.plan && r.plan.challenge_id === c.id);
        const days = list.reduce((a, i) => Math.max(a, i.day_no), 0);
        const from = m ? m.start_date : c.start_date;
        const doneN = list.filter((i) => done.includes(i.id)).length;
        const isOpen = open === c.id;
        const free = Number(c.price) === 0;
        return (
          <div key={c.id} className="card chal-card">
            <button type="button" className="chal-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : c.id)}>
              <span className="plan-top">
                <b className="plan-title">{L(c.title)}</b>
                <span className="plan-price">{free ? t('chal.free') : formatMoney(c.price, c.currency, locale)}</span>
              </span>
              <span className="muted small">
                {t('chal.meta', { n: list.length, days })}
                {from ? ` · ${fmt(from, locale)} – ${fmt(lastDate(from, list.length ? list : [{ day_no: 1 }]), locale)}` : c.mode === 'flex' ? ` · ${t('chal.flexStart')}` : ''}
              </span>
              {L(c.description) && <span className="body pre">{L(c.description)}</span>}
            </button>

            {active && (
              <div className="chal-progress" aria-label={t('chal.progress', { a: doneN, b: list.length })}>
                <span className="chal-bar"><i style={{ width: `${list.length ? (doneN / list.length) * 100 : 0}%` }} /></span>
                <span className="muted small">{t('chal.progress', { a: doneN, b: list.length })}</span>
              </div>
            )}

            {isOpen && (
              <ol className="chal-items">
                {list.map((i) => (
                  <li key={i.id} className={done.includes(i.id) ? 'is-done' : ''}>
                    <span className="muted small">{t('chal.day', { n: i.day_no })}{from ? ` · ${fmt(itemDate(from, i.day_no), locale)}` : ''}{String(i.start_time).slice(0, 5) !== '00:00' ? ` · ${String(i.start_time).slice(0, 5)}` : ''}</span>
                    <span>{L(i.title)}</span>
                  </li>
                ))}
              </ol>
            )}

            {!active && c.mode === 'flex' && !pending && (
              <label className="chal-start">
                <span className="muted small">{t('chal.pickStart')}</span>
                <input type="date" className="field" value={start} min={iso(new Date())} onChange={(e) => setStart(e.target.value)} />
              </label>
            )}

            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {active ? (
                <>
                  <span className="chal-in">✓ {t('chal.inSchedule')}</span>
                  <ConfirmButton className="btn-ghost btn-small" label={t('chal.leave')} confirmLabel={t('chal.leaveConfirm')} onConfirm={() => leave(c)} />
                </>
              ) : m ? (
                <button type="button" className="btn-primary" disabled={busy === c.id} onClick={() => join(c)}>{t('chal.add')}</button>
              ) : free ? (
                <button type="button" className="btn-primary" disabled={busy === c.id} onClick={() => join(c)}>{t('chal.join')}</button>
              ) : pending ? (
                <button type="button" className="btn-ghost" disabled>{t('chal.pending')}</button>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onBuy({ id: null, challenge_id: c.id, title: c.title, description: c.description, sections: [], exercises: [], days: 0, price: c.price, currency: c.currency, start_date: c.mode === 'flex' ? start : c.start_date })}
                >
                  {t('chal.buy')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
