import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getExercises, CATEGORIES } from '../data/api.js';

export default function Section() {
  const { category } = useParams();
  const { t, tEx } = useI18n();
  const { ready, hasAccess } = useAuth();
  const [items, setItems] = useState([]);
  useEffect(() => {
    getExercises({ category }).then(setItems);
  }, [category]);

  const title = CATEGORIES.includes(category) ? t(`cat.${category}.title`) : t('section.exercises');
  if (!ready) return <main className="page" />;
  if (CATEGORIES.includes(category) && !hasAccess(category)) return <Locked section={category} title={title} />;
  return (
    <main className="page">
      <TopBar title={title} />
      <div className="list">
        {items.map((e) => (
          <Link key={e.id} to={`/exercise/${e.id}`} className="list-item">
            <span className="list-main">
              <span className="list-title">{tEx(e, 'title')}</span>
              <span className="muted small">{tEx(e, 'sets')}</span>
            </span>
            <span className="muted">
              <Icon name="chevron" size={20} />
            </span>
          </Link>
        ))}
      </div>
      {!items.length && <p className="muted">{t('section.empty')}</p>}
    </main>
  );
}
