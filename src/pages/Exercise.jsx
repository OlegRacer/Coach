import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Media from '../components/Media.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getExercise, getMuscles } from '../data/api.js';

export default function Exercise() {
  const { id } = useParams();
  const { t, tEx } = useI18n();
  const { ready, hasAccess } = useAuth();
  const [ex, setEx] = useState(null);
  const [muscles, setMuscles] = useState([]);

  useEffect(() => {
    getExercise(id).then(setEx);
    getMuscles().then(setMuscles);
  }, [id]);

  if (!ex) {
    return (
      <main className="page">
        <TopBar title={t('exercise.title')} />
        <p className="muted">{t('exercise.notFound')}</p>
      </main>
    );
  }

  if (!ready) return <main className="page" />;
  if (ex.category && !hasAccess(ex.category)) return <Locked section={ex.category} title={t('exercise.title')} />;

  const list = ex.muscles.map((m) => muscles.find((x) => x.id === m)).filter(Boolean);
  const title = tEx(ex, 'title');

  return (
    <main className="page">
      <TopBar title={title} to={`/section/${ex.category}`} />

      <Media src={ex.preview} title={title} />

      <section className="card">
        <div className="row between">
          <h2 className="h2">{t('exercise.sets')}</h2>
          <b>{tEx(ex, 'sets')}</b>
        </div>
        <p className="body">{tEx(ex, 'description')}</p>
      </section>

      <section className="card">
        <h2 className="h2">{t('exercise.muscles')}</h2>
        <div className="chips">
          {list.map((m) => (
            <Link key={m.id} to={`/anatomy?m=${m.id}`} className="chip">
              {t(`muscle.${m.id}`)}
            </Link>
          ))}
        </div>
      </section>

      {ex.video && (
        <section className="stack">
          <h2 className="h2 section-title">{t('exercise.video')}</h2>
          <YouTubePlayer id={ex.video} />
        </section>
      )}
    </main>
  );
}
