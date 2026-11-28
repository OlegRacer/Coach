import { useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { LANGS, useI18n } from '../i18n/index.jsx';
import { useContent } from '../lib/content.jsx';
import { ensurePoster } from '../lib/poster.js';

// Адмінка «Переклад»: експорт українських текстів, переклад ШІ та імпорт назад.
export default function ContentAdmin() {
  const { t } = useI18n();
  const { ready, isAdmin } = useAuth();
  if (!ready) return <main className="page" />;
  return (
    <main className="page">
      <TopBar title={t('content.link')} to="/" />
      {isAdmin ? <><Posters /><Translate /></> : <p className="muted">{t('students.noAccess')}</p>}
    </main>
  );
}

// Мініатюри-кадри для відео, які були завантажені раніше (нові створюються при збереженні вправи).
function Posters() {
  const { t } = useI18n();
  const { exercises } = useContent();
  const [state, setState] = useState(null);
  const run = async () => {
    const list = exercises.filter((e) => e.preview);
    let made = 0;
    let fail = 0;
    for (let i = 0; i < list.length; i += 1) {
      setState({ i: i + 1, n: list.length, made, fail });
      try {
        if (await ensurePoster(list[i].preview, list[i].preview_crop)) made += 1;
      } catch {
        fail += 1;
      }
    }
    setState({ done: true, made, fail });
  };
  return (
    <div className="stack" style={{ paddingInline: 16 }}>
      <button type="button" className="btn-ghost" disabled={!!state && !state.done} onClick={run}>{t('content.posters')}</button>
      <span className="muted small">
        {state && !state.done ? t('content.postersProgress', { i: state.i, n: state.n }) : state && state.done ? t('content.postersDone', { made: state.made, fail: state.fail }) : t('content.postersHint')}
      </span>
    </div>
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

  // Копіювання в буфер: спершу сучасний спосіб, потім запасний (прихований textarea), інакше лишається кнопка «Скопіювати».
  const writeClipboard = async (str) => {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch {
      /* пробуємо запасний спосіб */
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = str;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, str.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const [pending, setPending] = useState('');
  const copy = async () => {
    const out = exportKeys();
    const n = Object.keys(out).length;
    if (!n) {
      setMsg(t('content.nothingToTranslate'));
      return;
    }
    const json = JSON.stringify(out, null, 2);
    if (await writeClipboard(json)) {
      setPending('');
      setMsg(t('content.copied', { n }));
    } else {
      setPending(json);
      setMsg(t('content.copyTap', { n }));
    }
  };
  const copyAgain = async () => {
    if (await writeClipboard(pending)) {
      setMsg(t('content.copied', { n: Object.keys(JSON.parse(pending)).length }));
      setPending('');
    } else {
      setText(pending); // крайній випадок: показуємо текст, щоб скопіювати вручну
      setMsg(t('content.copyManual', { n: Object.keys(JSON.parse(pending)).length }));
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
      {pending && (
        <button type="button" className="btn-primary" onClick={copyAgain}>
          {t('content.copyBtn')}
        </button>
      )}
      <textarea className="field" rows={6} value={text} placeholder={t('content.pasteHere')} onChange={(e) => setText(e.target.value)} />
      <button type="button" className="btn-primary" disabled={!text.trim()} onClick={apply}>
        {t('content.import')}
      </button>
      {text && (
        <button type="button" className="btn-ghost" onClick={() => { setText(''); setMsg(''); }}>
          {t('content.clear')}
        </button>
      )}
      {msg && <p className="muted small" role="status">{msg}</p>}
    </section>
  );
}
