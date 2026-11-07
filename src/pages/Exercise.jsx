import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import useOnline from '../lib/useOnline.js';
import { getExercise, getMuscles } from '../data/api.js';

export default function Exercise() {
  const { id } = useParams();
  const online = useOnline();
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

      <div className="video">
        {ex.video && online ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${ex.video}`}
            title={ex.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="video-empty">
            {ex.video ? 'Відео доступне лише онлайн' : 'Відео ще не додано'}
          </div>
        )}
      </div>

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
    </main>
  );
}
