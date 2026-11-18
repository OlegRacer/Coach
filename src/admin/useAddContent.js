import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/index.jsx';
import { useContent } from '../lib/content.jsx';
import { newId } from './ContentCommon.jsx';

// Створення нового розділу чи вправи всередині розділу sid (sid порожній = верхній рівень).
export default function useAddContent(sid) {
  const { t } = useI18n();
  const nav = useNavigate();
  const { section, exercisesOf, childrenOf, rawSections, reload } = useContent();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fail = (e) => setErr(e ? `${e.code || ''} ${e.message || ''}`.trim() : '');

  const addSub = async () => {
    const parent = sid ? section(sid) : null;
    const id = newId('s');
    setBusy(true);
    const { error } = await supabase.from('content_sections').insert({
      id,
      kind: 'exercises',
      parent_id: sid || null,
      title: { uk: t('content.newSection') },
      ...(parent ? { icon: parent.icon, color: parent.color } : {}),
      position: sid ? childrenOf(sid).length : rawSections.filter((s) => !s.parent_id).length,
      published: false
    });
    setBusy(false);
    if (error) return fail(error);
    await reload();
    nav(`/admin/content/${id}`);
  };

  const addEx = async () => {
    const id = newId('e');
    setBusy(true);
    const { error } = await supabase.from('content_exercises').insert({
      id,
      section_id: sid,
      title: { uk: t('content.newExercise') },
      position: exercisesOf(sid).length,
      published: false
    });
    setBusy(false);
    if (error) return fail(error);
    await reload();
    nav(`/admin/content/${sid}/${id}`);
  };

  return { addSub, addEx, busy, err };
}
