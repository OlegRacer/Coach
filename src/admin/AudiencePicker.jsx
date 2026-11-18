import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/index.jsx';

// «Для кого»: усі учні або окремі. value — масив id учнів (порожній = усі).
export default function AudiencePicker({ value, onChange }) {
  const { t } = useI18n();
  const list = value || [];
  const [mode, setMode] = useState(list.length ? 'some' : 'all');
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (mode !== 'some' || rows) return;
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows((data || []).filter((p) => p.role !== 'admin')));
  }, [mode, rows]);

  const pick = (m) => {
    setMode(m);
    if (m === 'all') onChange([]);
  };
  const toggle = (id) => onChange(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const shown = (rows || []).filter((p) => !q || `${p.full_name || ''} ${p.email || ''}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="aud-picker">
      <span className="muted small">{t('aud.title')}</span>
      <div className="chips">
        <button type="button" className={'chip' + (mode === 'all' ? ' active' : '')} aria-pressed={mode === 'all'} onClick={() => pick('all')}>
          {t('aud.all')}
        </button>
        <button type="button" className={'chip' + (mode === 'some' ? ' active' : '')} aria-pressed={mode === 'some'} onClick={() => pick('some')}>
          {t('aud.some')}{list.length ? ` · ${list.length}` : ''}
        </button>
      </div>
      {mode === 'some' && (
        <div className="access-panel">
          <input className="field" type="search" placeholder={t('aud.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          {!rows && <span className="muted small">{t('admin.loading')}</span>}
          {rows && !shown.length && <span className="muted small">{t('aud.none')}</span>}
          <div className="aud-list">
            {shown.map((p) => (
              <label key={p.id} className="access-row">
                <input type="checkbox" checked={list.includes(p.id)} onChange={() => toggle(p.id)} />
                <span>
                  {p.full_name || p.email}
                  {p.full_name && p.email && <small>{p.email}</small>}
                </span>
              </label>
            ))}
          </div>
          {list.length === 0 && <span className="muted small">{t('aud.empty')}</span>}
        </div>
      )}
    </div>
  );
}
