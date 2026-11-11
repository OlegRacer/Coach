import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

export default function Section() {
  const { category } = useParams();
  const { t } = useI18n();
  const { ready, hasAccess, hasExercise } = useAuth();
  const { section, exercisesOf } = useContent();
  const L = useL();
  const sec = section(category);
  const all = exercisesOf(category);
  const full = hasAccess(category);
  // Якщо весь розділ не відкрито, показуємо лише вправи, відкриті окремо (пакет оплати).
  const items = full ? all : all.filter((e) => hasExercise(e.id));

  const title = sec ? L(sec.title) : t('section.exercises');
  if (!ready) return <main className="page" />;
  if (!sec) return (
    <main className="page">
      <TopBar title={title} />
      <p className="muted">{t('section.empty')}</p>
    </main>
  );
  if (!full && !items.length) return <Locked section={category} title={title} />;
  return (
    <main className="page">
      <TopBar title={title} />
      {!full && (
        <div className="card partial-note">
          <span className="muted small">{t('access.partialNote', { n: items.length })}</span>
          <Link to="/plans" className="link-btn">{t('pay.howToOpen')}</Link>
        </div>
      )}
      <div className="list">
        {items.map((e) => (
          <Link key={e.id} to={`/exercise/${e.id}`} className="list-item">
            <span className="list-main">
              <span className="list-title">{L(e.title)}{!e.published && <span className="badge-draft">{t('content.draft')}</span>}</span>
              <span className="muted small">{L(e.sets)}</span>
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
