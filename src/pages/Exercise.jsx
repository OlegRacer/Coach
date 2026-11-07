import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Media from '../components/Media.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';
import { getExercise, getMuscles } from '../data/api.js';

export default function Exercise() {
  const { id } = useParams();
  const [ex, setEx] = useState(null);
  const [muscles, setMuscles] = useState([]);

  useEffect(() => {
    getExercise(id).then(setEx);
    getMuscles().then(setMuscles);
  }, [id]);

  if (!ex) {
    return (
      <main className="page">
        <TopBar title="Вправа" />
        <p className="muted">Вправу не знайдено.</p>
      </main>
    );
  }

  const names = ex.muscles.map((m) => muscles.find((x) => x.id === m)).filter(Boolean);

  return (
    <main className="page">
      <TopBar title={ex.title} to={`/section/${ex.category}`} />

      <Media src={ex.preview} title={ex.title} />

      <section className="card">
        <div className="row between">
          <h2 className="h2">Підходи</h2>
          <b>{ex.sets}</b>
        </div>
        <p className="body">{ex.description}</p>
      </section>

      <section className="card">
        <h2 className="h2">Працюють м'язи</h2>
        <div className="chips">
          {names.map((m) => (
            <Link key={m.id} to={`/anatomy?m=${m.id}`} className="chip">
              {m.name}
            </Link>
          ))}
        </div>
      </section>

      {ex.video && (
        <section className="stack">
          <h2 className="h2 section-title">Відео</h2>
          <YouTubePlayer id={ex.video} title={ex.videoTitle || 'Дивитись відео'} />
        </section>
      )}
    </main>
  );
}
