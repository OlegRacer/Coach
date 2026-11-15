import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

// Власна програма учня: перелік вправ, які він зібрав.
export default function MyProgram() {
  const { id } = useParams();
  const { t } = useI18n();
  const L = useL();
  const { exercise, exerciseOpen } = useContent();
  const [prog, setProg] = useState(undefined);

  useEffect(() => {
    supabase
      .from('student_programs')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setProg(data || null));
  }, [id]);

  return (
    <main className="page">
      <TopBar title={prog ? prog.title : t('aw.program')} to="/schedule" />
      {prog === null && <p className="muted">{t('aw.programGone')}</p>}
      <div className="list">
        {prog &&
          prog.exercise_ids.map((eid) => {
            const e = exercise(eid);
            if (!e) return null;
            return (
              <Link key={eid} to={`/exercise/${eid}`} className={'list-item' + (exerciseOpen(e) ? '' : ' locked-tile')}>
                <span className="list-main">
                  <span className="list-title">{L(e.title)}</span>
                  {(prog.exercise_sets || {})[eid] && <span className="muted small">{t('aw.setsCount', { n: prog.exercise_sets[eid] })}</span>}
                </span>
                <Icon name={exerciseOpen(e) ? 'chevron' : 'lock'} size={20} />
              </Link>
            );
          })}
      </div>
    </main>
  );
}
