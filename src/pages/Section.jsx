import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { getExercises, CATEGORIES } from '../data/api.js';

export default function Section() {
  const { category } = useParams();
  const [items, setItems] = useState([]);
  useEffect(() => {
    getExercises({ category }).then(setItems);
  }, [category]);

  const meta = CATEGORIES[category];
  return (
    <main className="page">
      <TopBar title={meta ? meta.title : 'Вправи'} />
      <div className="list">
        {items.map((e) => (
          <Link key={e.id} to={`/exercise/${e.id}`} className="list-item">
            <span className="list-main">
              <span className="list-title">{e.title}</span>
              <span className="muted small">{e.sets}</span>
            </span>
            <span className="muted">
              <Icon name="chevron" size={20} />
            </span>
          </Link>
        ))}
      </div>
      {!items.length && <p className="muted">У цьому розділі ще немає вправ.</p>}
    </main>
  );
}
