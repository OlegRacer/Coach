import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Media from '../components/Media.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL, mediaUrl } from '../lib/content.jsx';
import { ConfirmButton, LangField } from './ContentCommon.jsx';
import { youtubeId, parseTime, fmtTime, videosOf } from '../lib/video.js';

export { youtubeId };

const emptyVideo = () => ({ id: '', label: {}, start: '', end: '', loops: '1' });

function Toggle({ label, on, onChange }) {
  return (
    <label className="access-row field-toggle">
      <input type="checkbox" checked={on} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
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
  const [on, setOn] = useState({ sets: true, description: true, muscles: true, preview: true });

  useEffect(() => {
    if (ex && !f) {
      setF({
        title: ex.title, description: ex.description, sets: ex.sets, muscles: ex.muscles || [],
        preview: ex.preview || '',
        videos: videosOf(ex).map((v) => ({ id: v.id, label: v.label || {}, start: v.start ? fmtTime(v.start) : '', end: v.end ? fmtTime(v.end) : '', loops: String(v.loops ?? 1) })),
        published: ex.published
      });
      const has = (v) => !!v && Object.values(v).some((x) => String(x || '').trim());
      const fresh = !has(ex.sets) && !has(ex.description) && !(ex.muscles || []).length && !ex.preview;
      setOn({ sets: fresh || has(ex.sets), description: fresh || has(ex.description), muscles: fresh || (ex.muscles || []).length > 0, preview: fresh || !!ex.preview });
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
  const flip = (k) => {
    setSaved(false);
    setOn((x) => ({ ...x, [k]: !x[k] }));
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

  const setVideo = (i, patch) => {
    setSaved(false);
    setF((x) => ({ ...x, videos: x.videos.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  };

  const save = async () => {
    const vids = f.videos
      .map((v) => {
        const n = parseInt(v.loops, 10);
        return { id: youtubeId(v.id), label: v.label || {}, start: parseTime(v.start), end: parseTime(v.end), loops: Number.isFinite(n) && n >= 0 ? Math.min(n, 99) : 1 };
      })
      .filter((v) => v.id);
    setBusy(true);
    const { error } = await supabase
      .from('content_exercises')
      .update({
        ...f,
        sets: on.sets ? f.sets : {},
        description: on.description ? f.description : {},
        muscles: on.muscles ? f.muscles : [],
        preview: on.preview ? f.preview : '',
        videos: vids,
        video: vids.length ? vids[0].id : '',
        updated_at: new Date().toISOString()
      })
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
        <Toggle label={t('exercise.sets')} on={on.sets} onChange={() => flip('sets')} />
        {on.sets && <LangField value={f.sets} onChange={(v) => set('sets', v)} maxLength={60} />}

        <Toggle label={t('content.fieldDescription')} on={on.description} onChange={() => flip('description')} />
        {on.description && <LangField value={f.description} onChange={(v) => set('description', v)} multiline />}

        <Toggle label={t('exercise.muscles')} on={on.muscles} onChange={() => flip('muscles')} />
        {on.muscles && (
          <div className="chips">
            {muscles.map((m) => (
              <button type="button" key={m.id} className={'chip' + (f.muscles.includes(m.id) ? ' active' : '')} aria-pressed={f.muscles.includes(m.id)} onClick={() => toggleMuscle(m.id)}>
                {t(`muscle.${m.id}`)}
              </button>
            ))}
          </div>
        )}

        <Toggle label={t('content.preview')} on={on.preview} onChange={() => flip('preview')} />
        {on.preview && (
          <>
            <Media src={mediaUrl(f.preview)} title="" />
            <label className="btn-ghost file-btn">
              {busy ? t('content.uploading') : f.preview ? t('content.replaceFile') : t('content.uploadFile')}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" hidden disabled={busy} onChange={(e) => upload(e.target.files[0])} />
            </label>
            <span className="muted small">{t('content.fileLimit')}</span>
          </>
        )}

        <span className="muted small">{t('content.videos')}</span>
        {f.videos.map((v, i) => (
          <div key={i} className="video-row">
            <input className="field" value={v.id} placeholder="https://youtu.be/…" onChange={(e) => setVideo(i, { id: e.target.value })} />
            <LangField label={t('content.videoLabel')} value={v.label} onChange={(l) => setVideo(i, { label: l })} maxLength={60} />
            <div className="grid2">
              <label className="stack">
                <span className="muted small">{t('content.videoStart')}</span>
                <input className="field" inputMode="numeric" placeholder="0:00" value={v.start} onChange={(e) => setVideo(i, { start: e.target.value })} />
              </label>
              <label className="stack">
                <span className="muted small">{t('content.videoEnd')}</span>
                <input className="field" inputMode="numeric" placeholder="1:30" value={v.end} onChange={(e) => setVideo(i, { end: e.target.value })} />
              </label>
              <label className="stack">
                <span className="muted small">{t('content.videoLoops')}</span>
                <input className="field" inputMode="numeric" value={v.loops} onChange={(e) => setVideo(i, { loops: e.target.value.replace(/\D/g, '') })} />
              </label>
            </div>
            <button type="button" className="btn-ghost danger" onClick={() => { setSaved(false); setF((x) => ({ ...x, videos: x.videos.filter((_, j) => j !== i) })); }}>
              {t('content.removeVideo')}
            </button>
          </div>
        ))}
        {f.videos.length < 8 && (
          <button type="button" className="btn-ghost" onClick={() => { setSaved(false); setF((x) => ({ ...x, videos: [...x.videos, emptyVideo()] })); }}>
            {t('content.addVideo')}
          </button>
        )}

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
