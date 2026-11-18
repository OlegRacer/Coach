import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { LANGS, useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { newId } from './ContentCommon.jsx';
import EditFab from '../components/EditFab.jsx';
import useSortable from '../lib/useSortable.js';

// Адмінка контенту: список розділів, порядок, чернетки, а також експорт/імпорт перекладу.
export default function ContentAdmin() {
  const { t } = useI18n();
  const L = useL();
  const nav = useNavigate();
  const { ready, isAdmin } = useAuth();
  const { rawSections: allSections, exercises, reload, subtreeIds } = useContent();
  const rawSections = allSections.filter((s) => !s.parent_id);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const byId = Object.fromEntries(rawSections.map((x) => [x.id, x]));
  const sort = useSortable(rawSections.map((x) => x.id), (ids) => reorder(ids), isAdmin);

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

  const reorder = async (ids) => {
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
        {sort.order.map((id) => {
          const x = byId[id];
          if (!x) return null;
          const rp = sort.rowProps(id);
          return (
            <div key={id} {...rp} className={'edit-wrap ' + (rp.className || '')}>
              <Link to={x.kind === 'anatomy' ? `/admin/content/${x.id}` : `/section/${x.id}`} className="list-item" draggable={false}>
                <span className="list-main">
                  <span className="list-title">
                    {L(x.title) || x.id}
                    {!x.published && <span className="badge-draft">{t('content.draft')}</span>}
                  </span>
                  <span className="muted small">
                    {x.kind === 'anatomy' ? t('content.anatomyKind') : t('content.exCount', { n: exercises.filter((e) => e.section_id === x.id).length })}
                  </span>
                </span>
              </Link>
              <EditFab to={`/admin/content/${x.id}`} />
            </div>
          );
        })}
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
    exercises.forEach((e) =>
      (e.videos || []).forEach((v, i) => {
        const src = v.label && v.label.uk;
        if (src && (all || !(v.label[lang] || '').trim())) out[`v.${e.id}.${i}`] = src;
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
    exercises.forEach((e) =>
      (e.videos || []).forEach((v, i) => {
        const val = parsed[`v.${e.id}.${i}`];
        if (typeof val === 'string' && val.trim()) {
          const k = 'content_exercises:' + e.id;
          const p = patches.get(k) || { table: 'content_exercises', id: e.id, data: {} };
          const vids = p.data.videos || (e.videos || []).map((x) => ({ ...x }));
          vids[i] = { ...vids[i], label: { ...(vids[i].label || {}), [lang]: val.trim() } };
          p.data.videos = vids;
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
