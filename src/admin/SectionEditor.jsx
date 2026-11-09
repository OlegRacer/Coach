import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';
import { ConfirmButton, ICONS, COLORS, LangField, newId } from './ContentCommon.jsx';

// Редактор розділу: назва, підпис, іконка, колір, публікація, а також вправи розділу.
export default function SectionEditor() {
  const { sid } = useParams();
  const { t } = useI18n();
  const L = useL();
  const nav = useNavigate();
  const { ready, isAdmin } = useAuth();
  const { section, exercisesOf, reload } = useContent();
  const sec = section(sid);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (sec && !f) setF({ title: sec.title, hint: sec.hint, icon: sec.icon, color: sec.color, published: sec.published });
  }, [sec, f]);

  if (!ready) return <main className="page" />;
  if (!isAdmin) return <main className="page"><TopBar title={t('content.title')} to="/admin/content" /><p className="muted">{t('students.noAccess')}</p></main>;
  if (!sec || !f) return <main className="page"><TopBar title={t('content.title')} to="/admin/content" /><p className="muted">{t('section.empty')}</p></main>;

  const items = exercisesOf(sid);
  const fail = (e) => setErr(e ? `${e.code || ''} ${e.message || ''}`.trim() : '');
  const set = (k, v) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('content_sections').update({ ...f, updated_at: new Date().toISOString() }).eq('id', sid);
    setBusy(false);
    fail(error);
    if (!error) {
      setSaved(true);
      reload();
    }
  };

  const move = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((e) => e.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true);
    const res = await Promise.all(ids.map((id, p) => supabase.from('content_exercises').update({ position: p }).eq('id', id)));
    setBusy(false);
    fail(res.find((r) => r.error)?.error);
    reload();
  };

  const addEx = async () => {
    const id = newId('e');
    setBusy(true);
    const { error } = await supabase.from('content_exercises').insert({
      id,
      section_id: sid,
      title: { uk: t('content.newExercise') },
      position: items.length,
      published: false
    });
    setBusy(false);
    if (error) return fail(error);
    await reload();
    nav(`/admin/content/${sid}/${id}`);
  };

  const del = async () => {
    const { error } = await supabase.from('content_sections').delete().eq('id', sid);
    if (error) return fail(error);
    await reload();
    nav('/admin/content');
  };

  return (
    <main className="page">
      <TopBar title={L(sec.title) || t('content.title')} to="/admin/content" />
      {err && <p className="err" role="alert">{err}</p>}

      <section className="card stack">
        <LangField label={t('content.fieldTitle')} value={f.title} onChange={(v) => set('title', v)} maxLength={80} />
        <LangField label={t('content.fieldHint')} value={f.hint} onChange={(v) => set('hint', v)} maxLength={120} />

        <span className="muted small">{t('content.icon')}</span>
        <div className="chips">
          {ICONS.map((n) => (
            <button type="button" key={n} className={'chip icon-chip' + (f.icon === n ? ' active' : '')} aria-label={n} aria-pressed={f.icon === n} onClick={() => set('icon', n)}>
              <Icon name={n} size={22} />
            </button>
          ))}
        </div>
        <span className="muted small">{t('content.color')}</span>
        <div className="chips">
          {COLORS.map((c) => (
            <button type="button" key={c} className={'swatch' + (f.color === c ? ' on' : '')} style={{ background: c }} aria-label={c} aria-pressed={f.color === c} onClick={() => set('color', c)} />
          ))}
        </div>

        <label className="access-row">
          <input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} />
          <span>
            {t('content.published')}
            <small>{f.published ? t('content.publishedOn') : t('content.publishedOff')}</small>
          </span>
        </label>
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>
          {saved ? t('content.saved') : t('content.save')}
        </button>
      </section>

      {sec.kind === 'exercises' && (
        <>
          <h2 className="h2 section-title">{t('section.exercises')}</h2>
          <div className="list">
            {items.map((e, i) => (
              <div key={e.id} className="list-item">
                <Link to={`/admin/content/${sid}/${e.id}`} className="list-main">
                  <span className="list-title">
                    {L(e.title) || e.id}
                    {!e.published && <span className="badge-draft">{t('content.draft')}</span>}
                  </span>
                  <span className="muted small">{L(e.sets)}</span>
                </Link>
                <span className="sort-btns">
                  <button type="button" className="icon-btn" aria-label="↑" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    <Icon name="up" size={20} />
                  </button>
                  <button type="button" className="icon-btn" aria-label="↓" disabled={busy || i === items.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="down" size={20} />
                  </button>
                </span>
              </div>
            ))}
          </div>
          <button type="button" className="btn-primary" disabled={busy} onClick={addEx}>
            {t('content.addExercise')}
          </button>
          <ConfirmButton label={t('content.deleteSection')} confirmLabel={t('content.deleteSectionSure', { n: items.length })} onConfirm={del} />
        </>
      )}
    </main>
  );
}
