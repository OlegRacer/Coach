import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

// Мультивибір розділів і вправ у стилі випадаючих груп (як вибір м'язів).
// value: [{ kind: 'section'|'exercise', id }]
export default function RefPicker({ value, onChange }) {
  const { t } = useI18n();
  const L = useL();
  const { rawSections, exercises, childrenOf, subtreeIds } = useContent();
  const [rootOpen, setRootOpen] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [q, setQ] = useState('');
  const list = value || [];
  const has = (kind, id) => list.some((r) => r.kind === kind && r.id === id);
  const toggle = (kind, id) => onChange(has(kind, id) ? list.filter((r) => !(r.kind === kind && r.id === id)) : [...list, { kind, id }]);
  const flip = (id) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const exOf = (sid) => (exercises || []).filter((e) => e.section_id === sid);
  const name = (r) => {
    if (r.kind === 'exercise') { const e = (exercises || []).find((x) => x.id === r.id); return e ? L(e.title) || e.id : r.id; }
    const s = (rawSections || []).find((x) => x.id === r.id);
    return s ? L(s.title) || s.id : r.id;
  };
  // скільки вибрано всередині розділу (підрозділи й вправи, без самого розділу)
  const inside = (sid) => {
    const ids = subtreeIds(sid);
    return ids.filter((i) => i !== sid && has('section', i)).length + (exercises || []).filter((e) => ids.includes(e.section_id) && has('exercise', e.id)).length;
  };
  const total = (sid) => {
    const ids = subtreeIds(sid);
    return ids.length - 1 + (exercises || []).filter((e) => ids.includes(e.section_id)).length;
  };

  const box = (on, part) => (
    <span className={'mz-box' + (on ? ' on' : part ? ' part' : '')} aria-hidden="true">
      {on ? <Icon name="check" size={16} /> : part ? <Icon name="minus" size={16} /> : null}
    </span>
  );

  const groupNode = (s) => {
    const subs = childrenOf(s.id);
    const exs = exOf(s.id);
    const all = has('section', s.id);
    const cnt = inside(s.id);
    const isOpen = open.has(s.id);
    const expandable = subs.length > 0 || exs.length > 0;
    return (
      <div key={s.id} className={'mz-group' + (all || cnt ? ' has' : '')}>
        <div className="mz-head">
          <button type="button" className="mz-main" aria-pressed={all} onClick={() => toggle('section', s.id)}>
            {box(all, cnt > 0)}
            <span className="mz-name">{L(s.title) || s.id}</span>
            {cnt > 0 && <span className="mz-count muted small">{cnt}/{total(s.id)}</span>}
          </button>
          {expandable && (
            <button type="button" className="mz-toggle" aria-expanded={isOpen} aria-label={L(s.title) || s.id} onClick={() => flip(s.id)}>
              <span className={'mz-chev' + (isOpen ? ' open' : '')}><Icon name="down" size={20} /></span>
            </button>
          )}
        </div>
        {isOpen && expandable && (
          <div className="mz-subs">
            {subs.map((c) => groupNode(c))}
            {exs.map((e) => (
              <button key={e.id} type="button" className="mz-sub" aria-pressed={has('exercise', e.id)} onClick={() => toggle('exercise', e.id)}>
                {box(has('exercise', e.id))}
                <span className="mz-name">{L(e.title) || e.id}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // пошук: плоский список збігів
  const needle = q.trim().toLowerCase();
  const found = needle
    ? [
        ...(rawSections || []).filter((s) => (L(s.title) || '').toLowerCase().includes(needle)).map((s) => ({ kind: 'section', id: s.id, title: L(s.title) || s.id })),
        ...(exercises || []).filter((e) => (L(e.title) || '').toLowerCase().includes(needle)).map((e) => ({ kind: 'exercise', id: e.id, title: L(e.title) || e.id }))
      ].slice(0, 60)
    : [];

  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="muted small">{t('chal.f.link')}</span>
      <div className="mz-root">
        <button type="button" className="mz-rhead" aria-expanded={rootOpen} onClick={() => setRootOpen((v) => !v)}>
          <span className="mz-rname">{t('chal.ref.title')}</span>
          {list.length > 0 && <span className="mz-count muted small">{list.length}</span>}
          <span className={'mz-chev' + (rootOpen ? ' open' : '')}><Icon name="down" size={22} /></span>
        </button>
        {rootOpen && (
          <div className="mz-list">
            <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('chal.ref.search')} />
            {needle ? (
              <div className="mz-subs">
                {!found.length && <p className="muted small">{t('mem.empty')}</p>}
                {found.map((r) => (
                  <button key={r.kind + r.id} type="button" className="mz-sub" aria-pressed={has(r.kind, r.id)} onClick={() => toggle(r.kind, r.id)}>
                    {box(has(r.kind, r.id))}
                    <span className={'ref-kind ' + r.kind}>{t(`chal.ref.${r.kind}`)}</span>
                    <span className="mz-name">{r.title}</span>
                  </button>
                ))}
              </div>
            ) : (
              childrenOf('').map((s) => groupNode(s))
            )}
          </div>
        )}
      </div>
      {list.length > 0 && (
        <div className="chips">
          {list.map((r) => (
            <button type="button" key={r.kind + r.id} className="chip active ref-chip" aria-label={t('chal.ref.clear')} onClick={() => toggle(r.kind, r.id)}>
              <span className={'ref-kind ' + r.kind}>{t(`chal.ref.${r.kind}`)}</span>
              {name(r)} ×
            </button>
          ))}
        </div>
      )}
      {!list.length && <p className="muted small">{t('chal.ref.none')}</p>}
    </div>
  );
}
