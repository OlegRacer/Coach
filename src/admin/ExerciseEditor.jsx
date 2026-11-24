import { fixMp4 } from '../lib/mp4fix.js';
import { canConvertVideo, convertVideo, MAX_SECONDS } from '../lib/videoConvert.js';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { cropOf, cropStyle } from '../lib/crop.js';
import Media from '../components/Media.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL, mediaUrl } from '../lib/content.jsx';
import { useEquipment } from '../lib/equipment.jsx';
import { ConfirmButton, LangField } from './ContentCommon.jsx';
import TimeInput from './TimeInput.jsx';
import { GROUPS, muscleName } from '../lib/muscles.js';
import { youtubeId, videosOf } from '../lib/video.js';
import MuscleDropdown from '../components/MuscleDropdown.jsx';
import AudiencePicker from './AudiencePicker.jsx';
import Fold from './Fold.jsx';
import EquipIcon from '../components/EquipIcon.jsx';

export { youtubeId };

const emptyBlock = () => ({ start: 0, end: 0, loops: '1' });
const emptyVideo = () => ({ id: '', label: {}, blocks: [emptyBlock()] });

function Toggle({ label, on, onChange }) {
  return (
    <label className="access-row field-toggle">
      <input type="checkbox" checked={on} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

// Редактор вправи: тексти трьома мовами, м'язи, прев'ю (фото/mp4 у сховищі), відео YouTube, публікація.
// Кадрування квадратної мініатюри: перетягни відео пальцем і за потреби збільш.
function CropBox({ src, crop, onChange }) {
  const { t } = useI18n();
  const [c, setC] = useState(() => cropOf(crop)); // локальний стан: форма не перемальовується на кожен рух пальця
  const box = useRef(null);
  const vid = useRef(null);
  const drag = useRef(null);
  const timer = useRef(0);
  const [ar, setAr] = useState(16 / 9);
  const [dur, setDur] = useState(MAX_SECONDS);
  const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(src);
  useEffect(() => { setC(cropOf(crop)); }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), []);
  const commit = (n, now) => {
    setC(n);
    clearTimeout(timer.current);
    if (now) onChange(n);
    else timer.current = setTimeout(() => onChange(n), 200);
  };
  const seek = (sec) => {
    const v = vid.current;
    if (v && Number.isFinite(sec)) { try { v.currentTime = sec; } catch { /* ignore */ } }
  };
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, c }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const size = box.current ? box.current.offsetWidth : 160;
    const sx = 100 / (size * Math.max(ar - 1, 0.3)) / d.c.z;
    const sy = 100 / (size * Math.max(1 / ar - 1, 0.3)) / d.c.z;
    setC(cropOf({ ...d.c, x: d.c.x - (e.clientX - d.x) * sx, y: d.c.y - (e.clientY - d.y) * sy }));
  };
  const up = () => { if (drag.current) { drag.current = null; commit(c, true); } };
  const meta = (e) => {
    const v = e.currentTarget;
    if (v.videoHeight) setAr(v.videoWidth / v.videoHeight);
    if (Number.isFinite(v.duration) && v.duration > 0) { setDur(v.duration); seek(c.t || 0.001); return; }
    // записані браузером файли можуть не мати тривалості: примусово дізнаємось її
    const fix = () => { v.removeEventListener('timeupdate', fix); if (Number.isFinite(v.duration)) setDur(v.duration); v.currentTime = c.t || 0.001; };
    v.addEventListener('timeupdate', fix);
    v.currentTime = 1e7;
  };
  const style = cropStyle(c);
  const maxT = Math.max(0.1, Math.min(dur, 60));
  return (
    <div className="crop-wrap">
      <span className="muted small">{t('content.cropTitle')}: {t('content.cropHint')}</span>
      <div className="crop-box" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {isVideo ? (
          <video ref={vid} src={src + '#t=0.001'} muted playsInline preload="auto" style={style} onLoadedMetadata={meta} />
        ) : (
          <img src={src} alt="" draggable="false" style={style}
            onLoad={(e) => e.currentTarget.naturalHeight && setAr(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
        )}
      </div>
      {isVideo && (
        <label className="crop-zoom small muted">
          {t('content.cropFrame')} {c.t.toFixed(1)}s
          <input type="range" min="0" max={maxT} step="0.1" value={Math.min(c.t, maxT)}
            onChange={(e) => { const n = { ...c, t: Number(e.target.value) }; seek(n.t || 0.001); commit(n); }} />
        </label>
      )}
      <label className="crop-zoom small muted">
        {t('content.cropZoom')}
        <input type="range" min="1" max="3" step="0.05" value={c.z} onChange={(e) => commit({ ...c, z: Number(e.target.value) })} />
      </label>
      <button type="button" className="btn-ghost btn-small" onClick={() => commit({ ...c, x: 50, y: 50, z: 1 }, true)}>{t('content.cropReset')}</button>
    </div>
  );
}

export default function ExerciseEditor() {
  const { sid, eid } = useParams();
  const { t } = useI18n();
  const L = useL();
  const nav = useNavigate();
  const { ready, isAdmin } = useAuth();
  const { exercise, section, reload } = useContent();
  const { list: equipList } = useEquipment();
  const ex = exercise(eid);
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [prog, setProg] = useState(null);
  const [note, setNote] = useState('');
  const [on, setOn] = useState({ description: true, muscles: true, preview: true });

  useEffect(() => {
    if (ex && !f) {
      setF({
        title: ex.title, description: ex.description, muscles: ex.muscles || [], equipment: ex.equipment || [],
        preview: ex.preview || '',
        preview_crop: cropOf(ex.preview_crop),
        videos: videosOf(ex).map((v) => ({ id: v.id, label: v.label || {}, blocks: v.blocks.map((b) => ({ ...b, loops: String(b.loops) })) })),
        published: ex.published,
        audience: ex.audience || [],
        free: !!ex.free
      });
      const has = (v) => !!v && Object.values(v).some((x) => String(x || '').trim());
      const fresh = !has(ex.description) && !(ex.muscles || []).length && !ex.preview;
      setOn({ description: fresh || has(ex.description), muscles: fresh || (ex.muscles || []).length > 0, preview: true });
    }
  }, [ex, f]);

  const back = `/section/${sid}`;
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
    setErr('');
    setNote('');
    let body = file;
    let ctype = file.type;
    let ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (file.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(file.name)) {
      // Відео спершу перетворюємо на пристрої (зменшення, 30 к/с, без звуку, H.264), і лише потім вантажимо на сервер
      if (!canConvertVideo()) return setErr(t('content.convertUnsupported'));
      setBusy(true);
      setProg(0);
      try {
        const r = await convertVideo(file, { onProgress: setProg });
        body = r.blob;
        ctype = r.type;
        ext = r.ext;
        if (r.trimmed) setNote(t('content.convertTrimmed', { sec: MAX_SECONDS }));
        else setNote(t('content.convertDone', { mb: (r.blob.size / 1048576).toFixed(1) }));
      } catch (e) {
        setBusy(false);
        setProg(null);
        return setErr(t('content.convertFail'));
      }
      setProg(null);
      // faststart для mp4 (якщо потрібно)
      if (ctype === 'video/mp4') {
        try {
          const fixed = fixMp4(new Uint8Array(await body.arrayBuffer()));
          if (fixed) body = new Blob([fixed], { type: ctype });
        } catch (e) {
          /* лишаємо як є */
        }
      }
    }
    if (body.size > 30 * 1024 * 1024) {
      setBusy(false);
      return setErr(t('content.fileLimit'));
    }
    setBusy(true);
    const path = `${eid}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('content').upload(path, body, { contentType: ctype, cacheControl: '31536000' });
    setBusy(false);
    if (error) return fail(error);
    set('preview', path);
  };

  const setVideo = (i, patch) => {
    setSaved(false);
    setF((x) => ({ ...x, videos: x.videos.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  };

  const setBlock = (i, j, patch) => {
    setSaved(false);
    setF((x) => ({
      ...x,
      videos: x.videos.map((v, k) => (k === i ? { ...v, blocks: v.blocks.map((b, m) => (m === j ? { ...b, ...patch } : b)) } : v))
    }));
  };
  const addBlock = (i) => {
    setSaved(false);
    setF((x) => ({ ...x, videos: x.videos.map((v, k) => (k === i ? { ...v, blocks: [...v.blocks, emptyBlock()] } : v)) }));
  };
  const removeBlock = (i, j) => {
    setSaved(false);
    setF((x) => ({ ...x, videos: x.videos.map((v, k) => (k === i ? { ...v, blocks: v.blocks.filter((_, m) => m !== j) } : v)) }));
  };

  const save = async () => {
    const vids = f.videos
      .map((v) => {
        const blocks = v.blocks.map((b) => {
          const n = parseInt(b.loops, 10);
          return { start: b.start || 0, end: b.end > (b.start || 0) ? b.end : 0, loops: Number.isFinite(n) && n >= 0 ? n : 1 };
        });
        // start/end/loops першого блоку лишаємо для сумісності зі старою версією додатка.
        return { id: youtubeId(v.id), label: v.label || {}, blocks, ...blocks[0] };
      })
      .filter((v) => v.id);
    setBusy(true);
    const { error } = await supabase
      .from('content_exercises')
      .update({
        ...f,
        description: on.description ? f.description : {},
        muscles: on.muscles ? f.muscles : [],
        preview: on.preview ? f.preview : '',
        preview_crop: cropOf(f.preview_crop),
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

      <Fold title={t('content.fieldTitle')} summary={L(f.title)}>
          <LangField label={t('content.fieldTitle')} value={f.title} onChange={(v) => set('title', v)} maxLength={100} />

          <Toggle label={t('content.fieldDescription')} on={on.description} onChange={() => flip('description')} />
          {on.description && <LangField value={f.description} onChange={(v) => set('description', v)} multiline />}

      </Fold>
      <Fold title={t('exercise.muscles')} summary={on.muscles ? String((f.muscles || []).length) : ''} defaultOpen={false}>
          <Toggle label={t('exercise.muscles')} on={on.muscles} onChange={() => flip('muscles')} />
          {on.muscles && (
            <MuscleDropdown value={f.muscles} onToggle={toggleMuscle} />
          )}

      </Fold>
      {equipList.length > 0 && (
        <Fold title={t('equip.needed')} summary={String(f.equipment.length)} defaultOpen={false}>
          <div className="chips">
            {equipList.map((q) => (
              <button type="button" key={q.id} className={'chip equip-chip' + (f.equipment.includes(q.id) ? ' active' : '')} aria-pressed={f.equipment.includes(q.id)}
                onClick={() => set('equipment', f.equipment.includes(q.id) ? f.equipment.filter((x) => x !== q.id) : [...f.equipment, q.id])}>
                <EquipIcon item={q} size={24} /> {L(q.name)}
              </button>
            ))}
          </div>
        </Fold>
      )}
      <Fold title={t('content.previewVideo')} defaultOpen={false}>
          <Toggle label={t('content.preview')} on={on.preview} onChange={() => flip('preview')} />
          {on.preview && (
            <>
              <Media src={mediaUrl(f.preview)} title="" />
              <label className="btn-ghost file-btn">
                {prog !== null ? t('content.converting', { p: Math.round(prog * 100) }) : busy ? t('content.uploading') : f.preview ? t('content.replaceFile') : t('content.uploadFile')}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/*" hidden disabled={busy} onChange={(e) => upload(e.target.files[0])} />
              </label>
              <span className="muted small">{t('content.previewHint', { sec: MAX_SECONDS })}</span>
              {note && <span className="small" role="status">{note}</span>}
              {f.preview && <CropBox src={mediaUrl(f.preview)} crop={f.preview_crop} onChange={(c) => set('preview_crop', c)} />}
            </>
          )}

          <span className="muted small">{t('content.videos')}</span>
          {f.videos.map((v, i) => (
            <div key={i} className="video-row">
              <input className="field" value={v.id} placeholder="https://youtu.be/…" onChange={(e) => setVideo(i, { id: e.target.value })} />
              <LangField label={t('content.videoLabel')} value={v.label} onChange={(l) => setVideo(i, { label: l })} maxLength={60} />
              {v.blocks.map((b, j) => (
                <div key={j} className="block-row">
                  <div className="row between">
                    <b>{t('content.block', { n: j + 1 })}</b>
                    {v.blocks.length > 1 && (
                      <button type="button" className="link-btn danger-text" onClick={() => removeBlock(i, j)}>
                        {t('content.removeBlock')}
                      </button>
                    )}
                  </div>
                  <div className="grid2">
                    <label className="stack">
                      <span className="muted small">{t('content.videoStart')}</span>
                      <TimeInput value={b.start} placeholder="0:00" onChange={(sec) => setBlock(i, j, { start: sec })} />
                    </label>
                    <label className="stack">
                      <span className="muted small">{t('content.videoEnd')}</span>
                      <TimeInput value={b.end} placeholder={t('content.toEnd')} onChange={(sec) => setBlock(i, j, { end: sec })} />
                    </label>
                    <label className="stack">
                      <span className="muted small">{t('content.videoLoops')}</span>
                      <input className="field" inputMode="numeric" value={b.loops} onChange={(e) => setBlock(i, j, { loops: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" className="btn-ghost" onClick={() => addBlock(i)}>
                {t('content.addBlock')}
              </button>
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

      </Fold>
      <Fold title={t('content.published')} summary={f.published ? t('content.publishedOn') : t('content.publishedOff')} defaultOpen={false}>
          <label className="access-row">
            <input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} />
            <span>
              {t('content.published')}
              <small>{f.published ? t('content.publishedOn') : t('content.publishedOff')}</small>
            </span>
          </label>
          {f.published && <AudiencePicker value={f.audience} onChange={(v) => set('audience', v)} />}
          <label className="access-row">
            <input type="checkbox" checked={!!f.free} onChange={(e) => set('free', e.target.checked)} />
            <span>
              {t('content.free')}
              <small>{t('content.freeExHint')}</small>
            </span>
          </label>
      </Fold>
      <section className="card stack">
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>
          {saved ? t('content.saved') : t('content.save')}
        </button>
      </section>

      <ConfirmButton label={t('content.deleteExercise')} confirmLabel={t('content.sure')} onConfirm={del} />
    </main>
  );
}
