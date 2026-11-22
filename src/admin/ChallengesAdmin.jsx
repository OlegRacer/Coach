import { useCallback, useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { formatMoney } from '../lib/money.js';
import { itemDate } from '../lib/challenges.js';
import { iso } from '../lib/schedule.js';
import { ConfirmButton, LangField } from './ContentCommon.jsx';

const errText = (e) => (e ? `${e.code || ''} ${e.message || ''}`.trim() : '');
const blank = () => ({ id: null, title: {}, description: {}, mode: 'fixed', start_date: iso(new Date()), price: 0, currency: 'TWD', active: false, position: 0 });

// Адмінка челенджів: список, редактор із заняттями, учасники з прогресом.
export default function ChallengesAdmin() {
  const { t } = useI18n();
  const L = useL();
  const { ready, isAdmin } = useAuth();
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([
      supabase.from('challenges').select('*').order('position').order('created_at'),
      supabase.from('challenge_members').select('challenge_id').eq('status', 'active')
    ]);
    if (c.error) setErr(errText(c.error));
    setRows(c.data || []);
    const n = {};
    (m.data || []).forEach((x) => { n[x.challenge_id] = (n[x.challenge_id] || 0) + 1; });
    setCounts(n);
  }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!ready) return <main className="page" />;
  if (!isAdmin) return <main className="page"><TopBar title={t('chal.admin')} /><p className="muted">{t('students.noAccess')}</p></main>;
  if (edit) return <Editor key={edit.id || 'new'} start={edit} onClose={() => { setEdit(null); load(); }} />;

  return (
    <main className="page">
      <TopBar title={t('chal.admin')} />
      {err && <p className="err" role="alert">{err}</p>}
      <button type="button" className="btn-primary" onClick={() => setEdit(blank())}>{t('chal.new')}</button>
      {rows && !rows.length && <p className="muted">{t('chal.none')}</p>}
      <div className="list">
        {(rows || []).map((c) => (
          <button type="button" key={c.id} className="list-item" onClick={() => setEdit(c)}>
            <div className="list-main">
              <span className="list-title">{L(c.title) || '—'}</span>
              <span className="muted small">
                {Number(c.price) ? formatMoney(c.price, c.currency, 'uk') : t('chal.free')} · {t('chal.members', { n: counts[c.id] || 0 })} · {c.active ? t('chal.published') : t('chal.draft')}
              </span>
            </div>
            <Icon name="chevron" size={20} />
          </button>
        ))}
      </div>
    </main>
  );
}

function Editor({ start, onClose }) {
  const { t, locale } = useI18n();
  const L = useL();
  const { rawSections, chainOf } = useContent();
  const [c, setC] = useState(start);
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [doneBy, setDoneBy] = useState({});
  const [students, setStudents] = useState([]);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('edit');

  const loadAll = useCallback(async (id) => {
    if (!id) return;
    const [i, m] = await Promise.all([
      supabase.from('challenge_items').select('*').eq('challenge_id', id).order('day_no').order('start_time'),
      supabase.from('challenge_members').select('*, student:profiles!challenge_members_student_id_fkey(full_name, email)').eq('challenge_id', id).order('joined_at')
    ]);
    setItems((i.data || []).map((x) => ({ ...x, start_time: String(x.start_time).slice(0, 5) })));
    setMembers(m.data || []);
    const ids = (i.data || []).map((x) => x.id);
    if (ids.length) {
      const d = await supabase.from('challenge_done').select('student_id,item_id').in('item_id', ids);
      const by = {};
      (d.data || []).forEach((x) => { by[x.student_id] = (by[x.student_id] || 0) + 1; });
      setDoneBy(by);
    } else setDoneBy({});
  }, []);
  useEffect(() => { loadAll(c.id); }, [c.id, loadAll]);
  useEffect(() => {
    supabase.from('profiles').select('id, full_name, email').order('full_name').limit(300).then((r) => setStudents(r.data || []));
  }, []);

  const set = (k, v) => { setC((x) => ({ ...x, [k]: v })); setSaved(false); };
  const sections = [...(rawSections || [])].map((s) => ({ id: s.id, path: chainOf(s.id).map((a) => L(a.title) || a.id).join(' › ') })).sort((a, b) => a.path.localeCompare(b.path));

  const save = async () => {
    setBusy(true);
    setErr('');
    const row = {
      title: c.title, description: c.description, mode: c.mode,
      start_date: c.mode === 'fixed' ? c.start_date || null : null,
      price: Number(c.price) || 0, currency: c.currency || 'TWD', active: c.active, position: Number(c.position) || 0
    };
    let id = c.id;
    if (id) {
      const { error } = await supabase.from('challenges').update(row).eq('id', id);
      if (error) { setBusy(false); return setErr(errText(error)); }
    } else {
      const { data, error } = await supabase.from('challenges').insert(row).select().single();
      if (error) { setBusy(false); return setErr(errText(error)); }
      id = data.id;
      setC((x) => ({ ...x, id }));
    }
    // заняття: оновлюємо наявні за id (щоб не губити відмітки учнів), нові додаємо, прибрані видаляємо
    const rowOf = (x, n) => ({
      challenge_id: id, day_no: Number(x.day_no) || 1, start_time: x.start_time || '00:00', duration_min: Number(x.duration_min) || 30,
      title: x.title || {}, ref_kind: x.ref_id ? 'section' : null, ref_id: x.ref_id || null, position: n
    });
    const keep = items.filter((x) => x.id).map((x) => x.id);
    const { data: old } = await supabase.from('challenge_items').select('id').eq('challenge_id', id);
    const gone = (old || []).map((x) => x.id).filter((x) => !keep.includes(x));
    if (gone.length) {
      const del = await supabase.from('challenge_items').delete().in('id', gone);
      if (del.error) { setBusy(false); return setErr(errText(del.error)); }
    }
    const upd = items.map((x, n) => (x.id ? { id: x.id, ...rowOf(x, n) } : null)).filter(Boolean);
    if (upd.length) {
      const r = await supabase.from('challenge_items').upsert(upd, { onConflict: 'id' });
      if (r.error) { setBusy(false); return setErr(errText(r.error)); }
    }
    const add = items.map((x, n) => (x.id ? null : rowOf(x, n))).filter(Boolean);
    if (add.length) {
      const r = await supabase.from('challenge_items').insert(add);
      if (r.error) { setBusy(false); return setErr(errText(r.error)); }
    }
    setBusy(false);
    setSaved(true);
    loadAll(id);
  };

  const remove = async () => {
    const { error } = await supabase.from('challenges').delete().eq('id', c.id);
    if (error) return setErr(errText(error));
    onClose();
  };

  const addItem = () => {
    const last = items[items.length - 1];
    setItems([...items, { _k: Math.random(), day_no: last ? Number(last.day_no) + 1 : 1, start_time: last ? last.start_time : '00:00', duration_min: last ? last.duration_min : 30, title: {}, ref_id: '' }]);
    setSaved(false);
  };
  const patch = (n, p) => { setItems(items.map((x, i) => (i === n ? { ...x, ...p } : x))); setSaved(false); };
  const dup = (n) => {
    const x = items[n];
    setItems([...items.slice(0, n + 1), { ...x, id: undefined, _k: Math.random(), day_no: Number(x.day_no) + 1 }, ...items.slice(n + 1)]);
    setSaved(false);
  };

  const addMember = async () => {
    if (!pick) return;
    const { error } = await supabase.rpc('admin_add_member', { p_challenge: c.id, p_student: pick, p_start: c.mode === 'flex' ? iso(new Date()) : null });
    setErr(errText(error));
    setPick('');
    loadAll(c.id);
  };
  const removeMember = async (m) => {
    const { error } = await supabase.from('challenge_members').delete().eq('id', m.id);
    setErr(errText(error));
    loadAll(c.id);
  };

  return (
    <main className="page">
      <TopBar title={c.id ? L(c.title) || t('chal.admin') : t('chal.new')} />
      {err && <p className="err" role="alert">{err}</p>}
      {c.id && (
        <div className="chips">
          {['edit', 'members'].map((k) => (
            <button type="button" key={k} className={'chip' + (tab === k ? ' active' : '')} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {t(`chal.tab.${k}`)}{k === 'members' ? ` (${members.filter((m) => m.status === 'active').length})` : ''}
            </button>
          ))}
        </div>
      )}

      {tab === 'edit' && (
        <section className="card stack">
          <LangField label={t('chal.f.title')} value={c.title} onChange={(v) => set('title', v)} maxLength={120} />
          <LangField label={t('chal.f.desc')} value={c.description} multiline onChange={(v) => set('description', v)} />

          <span className="muted small">{t('chal.f.mode')}</span>
          <div className="chips">
            {['fixed', 'flex'].map((m) => (
              <button type="button" key={m} className={'chip' + (c.mode === m ? ' active' : '')} aria-pressed={c.mode === m} onClick={() => set('mode', m)}>{t(`chal.mode.${m}`)}</button>
            ))}
          </div>
          {c.mode === 'fixed' ? (
            <label className="stack" style={{ gap: 4 }}>
              <span className="muted small">{t('chal.f.start')}</span>
              <input type="date" className="field" value={c.start_date || ''} onChange={(e) => set('start_date', e.target.value)} />
            </label>
          ) : (
            <p className="muted small">{t('chal.flexHint')}</p>
          )}

          <div className="row" style={{ gap: 8 }}>
            <label className="stack" style={{ gap: 4, flex: 1 }}>
              <span className="muted small">{t('chal.f.price')}</span>
              <input type="number" min="0" inputMode="decimal" className="field" value={c.price} onChange={(e) => set('price', e.target.value)} />
            </label>
            <label className="stack" style={{ gap: 4, width: 90 }}>
              <span className="muted small">{t('chal.f.currency')}</span>
              <input className="field" maxLength={5} value={c.currency} onChange={(e) => set('currency', e.target.value.toUpperCase())} />
            </label>
          </div>
          <p className="muted small">{t('chal.priceHint')}</p>

          <label className="row" style={{ gap: 10 }}>
            <input type="checkbox" checked={c.active} onChange={(e) => set('active', e.target.checked)} />
            <span>{t('chal.f.active')}</span>
          </label>

          <h3 className="h3">{t('chal.f.items')}</h3>
          <div className="stack">
            {items.map((x, n) => (
              <div key={x.id || x._k} className="card stack chal-edit-item">
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <label className="stack" style={{ gap: 4, width: 80 }}>
                    <span className="muted small">{t('chal.f.day')}</span>
                    <input type="number" min="1" max="366" inputMode="numeric" className="field" value={x.day_no} onChange={(e) => patch(n, { day_no: e.target.value })} />
                  </label>
                  <label className="stack" style={{ gap: 4, width: 120 }}>
                    <span className="muted small">{t('chal.f.time')}</span>
                    <input type="time" className="field" value={x.start_time} onChange={(e) => patch(n, { start_time: e.target.value || '00:00' })} />
                  </label>
                  <label className="stack" style={{ gap: 4, width: 90 }}>
                    <span className="muted small">{t('chal.f.min')}</span>
                    <input type="number" min="5" max="600" inputMode="numeric" className="field" value={x.duration_min} onChange={(e) => patch(n, { duration_min: e.target.value })} />
                  </label>
                </div>
                <p className="muted small">{x.start_time === '00:00' ? t('chal.anyTime') : ''}{c.mode === 'fixed' && c.start_date ? ` ${itemDate(c.start_date, Number(x.day_no) || 1)}` : ''}</p>
                <LangField label={t('chal.f.itemTitle')} value={x.title} onChange={(v) => patch(n, { title: v })} maxLength={160} />
                <label className="stack" style={{ gap: 4 }}>
                  <span className="muted small">{t('chal.f.link')}</span>
                  <select className="field" value={x.ref_id || ''} onChange={(e) => patch(n, { ref_id: e.target.value })}>
                    <option value="">—</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.path}</option>)}
                  </select>
                </label>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="btn-ghost btn-small" onClick={() => dup(n)}>{t('chal.dup')}</button>
                  <button type="button" className="btn-ghost btn-small" onClick={() => { setItems(items.filter((_, i) => i !== n)); setSaved(false); }}>{t('sa.delete')}</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={addItem}>{t('chal.addItem')}</button>

          <button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? t('pay.sending') : t('chal.save')}</button>
          {saved && <p className="muted small" role="status">✓ {t('chal.saved')}</p>}
          {c.id && <ConfirmButton label={t('chal.delete')} confirmLabel={t('chal.deleteConfirm')} onConfirm={remove} />}
        </section>
      )}

      {tab === 'members' && (
        <section className="card stack">
          <div className="row" style={{ gap: 8 }}>
            <select className="field" style={{ flex: 1 }} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{t('chal.pickStudent')}</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
            </select>
            <button type="button" className="btn-primary btn-small" disabled={!pick} onClick={addMember}>{t('chal.add')}</button>
          </div>
          {!members.length && <p className="muted small">{t('chal.noMembers')}</p>}
          <div className="list">
            {members.map((m) => (
              <div key={m.id} className="list-item">
                <div className="list-main">
                  <span className="list-title">{(m.student && (m.student.full_name || m.student.email)) || m.student_id}</span>
                  <span className="muted small">
                    {t('chal.progress', { a: doneBy[m.student_id] || 0, b: items.length })} · {new Date(`${m.start_date}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                    {m.paid ? ` · ${t('chal.paid')}` : ''}{m.status === 'left' ? ` · ${t('chal.left')}` : ''}
                  </span>
                </div>
                <ConfirmButton className="btn-ghost btn-small" label={t('sa.delete')} confirmLabel={t('chal.deleteConfirm')} onConfirm={() => removeMember(m)} />
              </div>
            ))}
          </div>
          <p className="muted small">{t('chal.manualPayHint')}</p>
        </section>
      )}
    </main>
  );
}
