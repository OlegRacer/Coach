import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { LANGS, useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { newId } from './ContentCommon.jsx';

// Адмінка контенту: список розділів, порядок, чернетки, а також експорт/імпорт перекладу.
export default function ContentAdmin() {
  const { t } = useI18n();
  const L = useL();
  const nav = useNavigate();
  const { ready, isAdmin } = useAuth();
  const { rawSections, exercises, reload } = useContent();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ready) return <main className="page" />;
  if (!isAdmin) {
    return (
      <main className="page">
        <TopBar title={t('content.title')} />
        <p className="muted">{t('students.noAccess')}</p>
      </main>
    );
  }

  const fail = (e) => setErr(e ? `${e.code || ''} ${e.message || ''}`.trim() : '');

  const move = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rawSections.length) return;
    const ids = rawSections.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true);
    const res = await Promise.all(ids.map((id, p) => supabase.from('content_sections').update({ position: p }).eq('id', id)));
    setBusy(false);
    fail(res.find((r) => r.error)?.error);
    reload();
  };

  const add = async () => {
    const id = newId('s');
    setBusy(true);
    const { error } = await supabase.from('content_sections').insert({
      id,
      kind: 'exercises',
      title: { uk: t('content.newSection') },
      position: rawSections.length,
      published: false
    });
    setBusy(false);
    if (error) return fail(error);
    await reload();
    nav(`/admin/content/${id}`);
  };

  return (
    <main className="page">
      <TopBar title={t('content.title')} />
      {err && <p className="err" role="alert">{err}</p>}
      <p className="muted small">{t('content.intro')}</p>

      <div className="list">
        {rawSections.map((s, i) => (
          <div key={s.id} className="list-item">
            <Link to={`/admin/content/${s.id}`} className="list-main">
              <span className="list-title">
                {L(s.title) || s.id}
                {!s.published && <span className="badge-draft">{t('content.draft')}</span>}
              </span>
              <span className="muted small">
                {s.kind === 'anatomy' ? t('content.anatomyKind') : t('content.exCount', { n: exercises.filter((e) => e.section_id === s.id).length })}
              </span>
            </Link>
            <span className="sort-btns">
              <button type="button" className="icon-btn" aria-label="↑" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" size={20} />
              </button>
              <button type="button" className="icon-btn" aria-label="↓" disabled={busy || i === rawSections.length - 1} onClick={() => move(i, 1)}>
                <Icon name="down" size={20} />
              </button>
            </span>
          </div>
        ))}
      </div>
      <button type="button" className="btn-primary" disabled={busy} onClick={add}>
        {t('content.addSection')}
      </button>

      <Translate />
    </main>
  );
}

// Переклад без API: експортуємо українські тексти, ШІ перекладає, вставляємо назад.
function Translate() {
  const { t } = useI18n();
  const { rawSections, exercises, reload } = useContent();
  const [lang, setLang] = useState('en');
  const [all, setAll] = useState(false);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');

  const targets = LANGS.filter((l) => l.code !== 'uk');
  const rows = [
    ...rawSections.map((s) => ({ table: 'content_sections', pre: 's', row: s, fields: ['title', 'hint'] })),
    ...exercises.map((e) => ({ table: 'content_exercises', pre: 'e', row: e, fields: ['title', 'description', 'sets'] }))
  ];

  const exportKeys = () => {
    const out = {};
    rows.forEach(({ pre, row, fields }) =>
      fields.forEach((f) => {
        const src = row[f] && row[f].uk;
        if (src && (all || !(row[f][lang] || '').trim())) out[`${pre}.${row.id}.${f}`] = src;
      })
    );
    return out;
  };

  const copy = async () => {
    const out = exportKeys();
    const n = Object.keys(out).length;
    if (!n) {
      setMsg(t('content.nothingToTranslate'));
      return;
    }
    const json = JSON.stringify(out, null, 2);
    setText(json);
    try {
      await navigator.clipboard.writeText(json);
      setMsg(t('content.copied', { n }));
    } catch {
      setMsg(t('content.copyManual', { n }));
    }
  };

  const apply = async () => {
    let parsed;
    try {
      parsed = JSON.parse(text.trim().replace(/^```(?:json)?|```$/g, ''));
    } catch {
      setMsg(t('content.badJson'));
      return;
    }
    const patches = new Map();
    let n = 0;
    rows.forEach(({ table, pre, row, fields }) =>
      fields.forEach((f) => {
        const v = parsed[`${pre}.${row.id}.${f}`];
        if (typeof v === 'string' && v.trim()) {
          const k = table + ':' + row.id;
          const p = patches.get(k) || { table, id: row.id, data: {} };
          p.data[f] = { ...(p.data[f] || row[f] || {}), [lang]: v.trim() };
          patches.set(k, p);
          n += 1;
        }
      })
    );
    if (!n) {
      setMsg(t('content.nothingApplied'));
      return;
    }
    const res = await Promise.all([...patches.values()].map((p) => supabase.from(p.table).update(p.data).eq('id', p.id)));
    const bad = res.find((r) => r.error);
    setMsg(bad ? `${bad.error.code || ''} ${bad.error.message}` : t('content.applied', { n }));
    if (!bad) setText('');
    reload();
  };

  return (
    <section className="card stack">
      <h2 className="h2">{t('content.translate')}</h2>
      <p className="muted small">{t('content.translateHelp')}</p>
      <div className="chips">
        {targets.map((l) => (
          <button type="button" key={l.code} className={'chip' + (lang === l.code ? ' active' : '')} onClick={() => setLang(l.code)}>
            {l.name}
          </button>
        ))}
      </div>
      <label className="access-row">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        <span>{t('content.exportAll')}</span>
      </label>
      <button type="button" className="btn-ghost" onClick={copy}>
        {t('content.export')}
      </button>
      <textarea className="field" rows={6} value={text} placeholder={t('content.pasteHere')} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="btn-primary" disabled={!text.trim()} onClick={apply}>
        {t('content.import')}
      </button>
      {msg && <p className="muted small" role="status">{msg}</p>}
    </section>
  );
}
