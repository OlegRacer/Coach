import { useEffect, useState } from 'react';
import StudioPicker from '../components/StudioPicker.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Чий це учень: кілька тренерів можна відмітити одночасно. Список тренерів керується в «Розклад занять».
export function TrainerPicker({ student, trainers, mine, onChanged }) {
  const { t } = useI18n();
  const [err, setErr] = useState('');
  const toggle = async (id, on) => {
    setErr('');
    const q = on
      ? supabase.from('student_trainers').delete().eq('student_id', student.id).eq('trainer_id', id)
      : supabase.from('student_trainers').insert({ student_id: student.id, trainer_id: id });
    const { error } = await q;
    if (error) setErr(`${error.code || ''} ${error.message || ''}`.trim());
    else onChanged();
  };
  return (
    <div className="stack">
      <span className="muted small">{t('students.trainers')}</span>
      {!trainers.length && <span className="muted small">{t('students.noTrainers')}</span>}
      <div className="chips">
        {trainers.map((x) => {
          const on = mine.includes(x.id);
          return (
            <button type="button" key={x.id} className={'chip' + (on ? ' active' : '')} aria-pressed={on} onClick={() => toggle(x.id, on)}>
              {x.name}
            </button>
          );
        })}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

// Коментар тренера: бачать лише адміни, учень його не бачить.
export function NotePanel({ student, note, onChanged }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [text, setText] = useState(note || '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true);
    setErr('');
    const { error } = await supabase
      .from('student_notes')
      .upsert({ student_id: student.id, note: text.trim(), updated_by: user.id, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) setErr(`${error.code || ''} ${error.message || ''}`.trim());
    else {
      setSaved(true);
      onChanged();
    }
  };
  return (
    <div className="stack">
      <span className="muted small">{t('students.noteHint')}</span>
      <textarea
        className="field"
        rows={5}
        maxLength={4000}
        value={text}
        placeholder={t('students.notePlaceholder')}
        onChange={(e) => {
          setSaved(false);
          setText(e.target.value);
        }}
      />
      <button type="button" className="btn-primary" disabled={busy} onClick={save}>
        {saved ? t('content.saved') : t('content.save')}
      </button>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}

// Тренер сам задає студії й класи учня (або «Інше» — без студії).
export function StudioEditor({ student, studios, classes, links, classLinks, other, onChanged }) {
  const { t } = useI18n();
  const init = () => ({
    studios: links.filter((l) => l.student_id === student.id).map((l) => l.studio_id),
    classes: classLinks.filter((l) => l.student_id === student.id).map((l) => l.class_id),
    other: !!other
  });
  const [val, setVal] = useState(init);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    setVal(init());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, classLinks, other]);
  const save = async () => {
    setBusy(true);
    setErr('');
    const { error } = await supabase.rpc('admin_set_student_studios', {
      p_student: student.id,
      p_studios: val.studios,
      p_classes: val.classes,
      p_other: val.other
    });
    setBusy(false);
    if (error) setErr(`${error.code || ''} ${error.message || ''}`.trim());
    else {
      setSaved(true);
      onChanged();
    }
  };
  return (
    <div className="stack">
      <StudioPicker
        studios={studios}
        classes={classes}
        value={val}
        onChange={(v) => {
          setSaved(false);
          setVal(v);
        }}
      />
      <button type="button" className="btn-primary" disabled={busy} onClick={save}>
        {saved ? t('content.saved') : t('content.save')}
      </button>
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
