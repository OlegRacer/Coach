import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../auth/index.jsx';
import { supabase } from '../lib/supabase.js';

// Стискаємо знімок екрана до 1600 px по довшій стороні (JPEG), щоб не вантажити зайве.
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) throw new Error('encode');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// «Зворотний зв'язок»: повідомити про помилку чи запропонувати функцію. Фото необов'язкове.
export default function Feedback() {
  const { t } = useI18n();
  const { user, ready } = useAuth();
  const loc = useLocation();
  const [kind, setKind] = useState('bug');
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);
  const input = useRef(null);

  if (!ready) return <main className="page" />;

  const pick = (f) => {
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const clear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview('');
    if (input.current) input.current.value = '';
  };

  const send = async () => {
    if (!user || !text.trim()) return;
    setBusy(true);
    setErr('');
    let path = '';
    try {
      if (file) {
        const blob = await shrink(file);
        path = `${user.id}/${Date.now()}.jpg`;
        const up = await supabase.storage.from('feedback').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) throw up.error;
      }
      const from = (loc.state && loc.state.from) || document.referrer || '';
      const { error } = await supabase.from('feedback').insert({
        user_id: user.id,
        kind,
        message: text.trim(),
        photo_path: path,
        page: String(from).slice(0, 300),
        user_agent: navigator.userAgent.slice(0, 300)
      });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setErr(e && e.message ? e.message : t('fb.error'));
    }
    setBusy(false);
  };

  if (done) {
    return (
      <main className="page">
        <TopBar title={t('fb.title')} to="/profile" />
        <div className="card stack">
          <h2 className="h2">{t('fb.thanks')}</h2>
          <p className="muted">{t('fb.thanksText')}</p>
          <button type="button" className="btn-primary" onClick={() => { setDone(false); setText(''); clear(); }}>{t('fb.another')}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <TopBar title={t('fb.title')} to="/profile" />
      {!user ? (
        <p className="muted">{t('fb.signin')}</p>
      ) : (
        <div className="card stack">
          <div className="chips fb-kinds" role="radiogroup" aria-label={t('fb.title')}>
            {['bug', 'idea'].map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={'chip' + (kind === k ? ' active' : '')} onClick={() => setKind(k)}>
                {t(`fb.${k}`)}
              </button>
            ))}
          </div>
          <span className="muted small">{kind === 'bug' ? t('fb.bugHint') : t('fb.ideaHint')}</span>
          <textarea className="field" rows={6} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'bug' ? t('fb.bugPlaceholder') : t('fb.ideaPlaceholder')} />
          <div className="stack">
            <span className="muted small">{t('fb.photo')}</span>
            {preview && <img className="fb-preview" src={preview} alt="" />}
            <div className="fb-actions">
              <button type="button" className="btn-ghost" onClick={() => input.current && input.current.click()}>
                <Icon name="plus" size={18} /> {file ? t('fb.photoChange') : t('fb.photoAdd')}
              </button>
              {file && <button type="button" className="btn-ghost" onClick={clear}>{t('fb.photoRemove')}</button>}
            </div>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files && e.target.files[0])} />
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button type="button" className="btn-primary" disabled={busy || !text.trim()} onClick={send}>{busy ? t('fb.sending') : t('fb.send')}</button>
        </div>
      )}
    </main>
  );
}
