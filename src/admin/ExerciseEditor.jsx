import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Media from '../components/Media.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL, mediaUrl } from '../lib/content.jsx';
import { ConfirmButton, LangField } from './ContentCommon.jsx';

// Приймає повне посилання YouTube або сам id.
export function youtubeId(v) {
  const s = (v || '').trim();
  if (!s) return '';
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(s) ? s : s;
}

// Редактор вправи: тексти трьома мовами, м'язи, прев'ю (фото/mp4 у сховищі), відео YouTube, публікація.
export default function ExerciseEditor() {
  const { sid, eid } = useParams();
  const { t } = useI18n();
  const L = useL();
  const nav = useNavigate();
  const { ready, isAdmin } = useAuth();
  const { exercise, section, muscles, reload } = useContent();
  const ex = exercise(eid);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (ex && !f) {
      setF({
        title: ex.title, description: ex.description, sets: ex.sets, muscles: ex.muscles || [],
        preview: ex.preview || '', video: ex.video || '', published: ex.published
      });
    }
  }, [ex, f]);

  const back = `/admin/content/${sid}`;
  if (!ready) return <main className="page" />;
  if (!isAdmin) return <main className="page"><TopBar title={t('content.title')} to={back} /><p className="muted">{t('students.noAccess')}</p></main>;
  if (!ex || !f) return <main className="page"><TopBar title={t('content.title')} to={back} /><p className="muted">{t('exercise.notFound')}</p></main>;

  const sec = section(ex.section_id);
  const fail = (e) => setErr(e ? `${e.code || ''} ${e.message || ''}`.trim() : '');
  const set = (k, v) => {
    setSaved(false);
    setF((x) => ({ ...x, [k]: v }));
  };
  const toggleMuscle = (m) => set('muscles', f.muscles.includes(m) ? f.muscles.filter((x) => x !== m) : [...f.muscles, m]);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setErr('');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${eid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('content').upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    setBusy(false);
    if (error) return fail(error);
    set('preview', path);
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from('content_exercises')
      .update({ ...f, video: youtubeId(f.video), updated_at: new Date().toISOString() })
      .eq('id', eid);
    setBusy(false);
    fail(error);
    if (!error) {
      setSaved(true);
      reload();
    }
  };

  const del = async () => {
    const { error } = await supabase.from('content_exercises').delete().eq('id', eid);
    if (error) return fail(error);
    await reload();
    nav(back);
  };

  return (
    <main className="page">
      <TopBar title={L(ex.title) || t('exercise.title')} to={back} />
      {err && <p className="err" role="alert">{err}</p>}
      {sec && <p className="muted small">{L(sec.title)}</p>}

      <section className="card stack">
        <LangField label={t('content.fieldTitle')} value={f.title} onChange={(v) => set('title', v)} maxLength={100} />
        <LangField label={t('exercise.sets')} value={f.sets} onChange={(v) => set('sets', v)} maxLength={60} />
        <LangField label={t('content.fieldDescription')} value={f.description} onChange={(v) => set('description', v)} multiline />

        <span className="muted small">{t('exercise.muscles')}</span>
        <div className="chips">
          {muscles.map((m) => (
            <button type="button" key={m.id} className={'chip' + (f.muscles.includes(m.id) ? ' active' : '')} aria-pressed={f.muscles.includes(m.id)} onClick={() => toggleMuscle(m.id)}>
              {t(`muscle.${m.id}`)}
            </button>
          ))}
        </div>

        <span className="muted small">{t('content.preview')}</span>
        <Media src={mediaUrl(f.preview)} title="" />
        <label className="btn-ghost file-btn">
          {busy ? t('content.uploading') : f.preview ? t('content.replaceFile') : t('content.uploadFile')}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" hidden disabled={busy} onChange={(e) => upload(e.target.files[0])} />
        </label>
        <span className="muted small">{t('content.fileLimit')}</span>
        {f.preview && (
          <button type="button" className="btn-ghost danger" onClick={() => set('preview', '')}>
            {t('content.removeFile')}
          </button>
        )}

        <span className="muted small">{t('content.youtube')}</span>
        <input className="field" value={f.video} placeholder="https://youtu.be/…" onChange={(e) => set('video', e.target.value)} />

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

      <ConfirmButton label={t('content.deleteExercise')} confirmLabel={t('content.sure')} onConfirm={del} />
    </main>
  );
}
