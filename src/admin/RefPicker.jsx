import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

// Вибір розділу або вправи для заняття: кнопка з поточним вибором, у вікні пошук і вкладки «Усе / Розділи / Вправи».
// value: { kind: 'section'|'exercise'|null, id }
export default function RefPicker({ value, onChange }) {
  const { t } = useI18n();
  const L = useL();
  const { rawSections, exercises, chainOf } = useContent();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');

  const pathOf = (id) => chainOf(id).map((a) => L(a.title) || a.id).join(' › ');
  const rows = useMemo(() => {
    const secs = (rawSections || []).map((s) => ({ kind: 'section', id: s.id, title: L(s.title) || s.id, sub: pathOf(s.id) }));
    const exs = (exercises || []).map((e) => ({ kind: 'exercise', id: e.id, title: L(e.title) || e.id, sub: pathOf(e.section_id) }));
    return [...secs, ...exs];
  }, [rawSections, exercises]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = value && value.id ? rows.find((r) => r.kind === value.kind && r.id === value.id) : null;
  const needle = q.trim().toLowerCase();
  const shown = rows
    .filter((r) => (tab === 'all' || (tab === 'section' ? r.kind === 'section' : r.kind === 'exercise')) && (!needle || `${r.title} ${r.sub}`.toLowerCase().includes(needle)))
    .sort((a, b) => a.sub.localeCompare(b.sub) || a.title.localeCompare(b.title))
    .slice(0, 80);

  const pick = (r) => { onChange({ kind: r.kind, id: r.id }); setOpen(false); setQ(''); };

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="muted small">{t('chal.f.link')}</span>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="field ref-btn" onClick={() => setOpen(true)}>
          {cur ? (
            <>
              <span className={'ref-kind ' + cur.kind}>{t(`chal.ref.${cur.kind}`)}</span>
              <span className="ref-name">{cur.title}</span>
            </>
          ) : <span className="muted">{t('chal.ref.none')}</span>}
        </button>
        {cur && <button type="button" className="icon-btn" aria-label={t('chal.ref.clear')} onClick={() => onChange({ kind: null, id: '' })}><Icon name="close" size={20} /></button>}
      </div>

      {open && (
        <div className="ref-sheet" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className="ref-panel" onClick={(e) => e.stopPropagation()}>
            <div className="row between">
              <b>{t('chal.ref.title')}</b>
              <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={() => setOpen(false)}><Icon name="close" size={22} /></button>
            </div>
            <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('chal.ref.search')} autoFocus />
            <div className="chips">
              {['all', 'section', 'exercise'].map((k) => (
                <button type="button" key={k} className={'chip' + (tab === k ? ' active' : '')} aria-pressed={tab === k} onClick={() => setTab(k)}>{t(`chal.ref.tab.${k}`)}</button>
              ))}
            </div>
            <div className="ref-list">
              {!shown.length && <p className="muted small">{t('mem.empty')}</p>}
              {shown.map((r) => (
                <button type="button" key={r.kind + r.id} className={'ref-item' + (cur && cur.id === r.id && cur.kind === r.kind ? ' on' : '')} onClick={() => pick(r)}>
                  <span className={'ref-kind ' + r.kind}>{t(`chal.ref.${r.kind}`)}</span>
                  <span className="ref-text"><b>{r.title}</b>{r.sub && <span className="muted small">{r.sub}</span>}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
