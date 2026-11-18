import { useState } from 'react';
import Icon from './Icon.jsx';
import { GROUPS } from '../lib/muscles.js';
import { useI18n } from '../i18n/index.jsx';

// Вибір м'язів випадаючими групами (як в анатомії). value — масив id: група (= уся група) або окремі півзони.
export default function MuscleDropdown({ value, onToggle }) {
  const { t } = useI18n();
  const sel = new Set(value || []);
  const [rootOpen, setRootOpen] = useState(true);
  const [open, setOpen] = useState(() => new Set(GROUPS.filter((g) => (g.parts || []).some((p) => sel.has(p.id))).map((g) => g.id)));
  const flip = (id) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div className="mz-root">
      <button type="button" className="mz-rhead" aria-expanded={rootOpen} onClick={() => setRootOpen((v) => !v)}>
        <span className="mz-rname">{t('anatomy.groups')}</span>
        {sel.size > 0 && <span className="mz-count muted small">{sel.size}</span>}
        <span className={'mz-chev' + (rootOpen ? ' open' : '')}>
          <Icon name="down" size={22} />
        </span>
      </button>
      {rootOpen && (
        <div className="mz-list">
          {GROUPS.map((g) => {
            const parts = g.parts || [];
            const all = sel.has(g.id);
            const cnt = parts.filter((p) => sel.has(p.id)).length;
            const isOpen = open.has(g.id);
            return (
              <div key={g.id} className={'mz-group' + (all || cnt ? ' has' : '')}>
                <div className="mz-head">
                  <button type="button" className="mz-main" aria-pressed={all} onClick={() => onToggle(g.id)}>
                    <span className={'mz-box' + (all ? ' on' : cnt ? ' part' : '')} aria-hidden="true">
                      {all ? <Icon name="check" size={16} /> : cnt ? <Icon name="minus" size={16} /> : null}
                    </span>
                    <span className="mz-name">{t(`muscle.${g.id}`)}</span>
                    {cnt > 0 && <span className="mz-count muted small">{cnt}/{parts.length}</span>}
                  </button>
                  {parts.length > 0 && (
                    <button type="button" className="mz-toggle" aria-expanded={isOpen} aria-label={t(`muscle.${g.id}`)} onClick={() => flip(g.id)}>
                      <span className={'mz-chev' + (isOpen ? ' open' : '')}>
                        <Icon name="down" size={20} />
                      </span>
                    </button>
                  )}
                </div>
                {isOpen && parts.length > 0 && (
                  <div className="mz-subs">
                    {parts.map((p) => (
                      <button key={p.id} type="button" className="mz-sub" aria-pressed={sel.has(p.id)} onClick={() => onToggle(p.id)}>
                        <span className={'mz-box' + (sel.has(p.id) ? ' on' : '')} aria-hidden="true">
                          {sel.has(p.id) && <Icon name="check" size={16} />}
                        </span>
                        <span className="mz-name">{t(`muscle.${p.id}`)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
