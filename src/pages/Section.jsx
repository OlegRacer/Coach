import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

// Розділ містить підрозділи і/або вправи (на будь-яку глибину). Закрите учень бачить із замком,
// а відкрите окремо (пакет, «безкоштовно») лишається доступним.
export default function Section() {
  const { category } = useParams();
  const { t } = useI18n();
  const { ready, isAdmin } = useAuth();
  const { section, exercisesOf, childrenOf, chainOf, sectionOpen, exerciseOpen, openCount, isFreeSection } = useContent();
  const L = useL();
  const sec = section(category);
  const full = sectionOpen(category);
  const subs = childrenOf(category);
  const items = exercisesOf(category); // закриті (locked) показуємо із замком
  const total = openCount(category);

  const title = sec ? L(sec.title) : t('section.exercises');
  if (!ready) return <main className="page" />;
  if (!sec) return (
    <main className="page wide">
      <TopBar title={title} />
      <p className="muted">{t('section.empty')}</p>
    </main>
  );
  if (!full && !total) return <Locked section={category} title={title} />;
  const parent = chainOf(category).slice(-2, -1)[0];
  return (
    <main className="page wide">
      <TopBar title={title} to={parent ? `/section/${parent.id}` : '/'} />
      {!full && (
        <div className="card partial-note">
          <span className="muted small">{t('access.partialNote', { n: total })}</span>
          <Link to="/plans" className="link-btn">{t('pay.howToOpen')}</Link>
        </div>
      )}
      <div className="list">
        {subs.map((s) => {
          const open = sectionOpen(s.id);
          const n = open ? 0 : openCount(s.id);
          const locked = !open && !n;
          return (
            <Link key={s.id} to={`/section/${s.id}`} className={'list-item' + (locked ? ' locked-tile' : '')}>
              <span className="tile-icon small-icon" style={{ background: s.color }}>
                <Icon name={s.icon} size={22} />
              </span>
              <span className="list-main">
                <span className="list-title">
                  {L(s.title)}
                  {!s.published && <span className="badge-draft">{t('content.draft')}</span>}
                  {isFreeSection(s.id) && !isAdmin && <span className="badge-free">{t('content.free')}</span>}
                </span>
                <span className="muted small">{n > 0 ? t('access.partial', { n }) : L(s.hint)}</span>
              </span>
              <span className="muted">
                <Icon name={locked ? 'lock' : 'chevron'} size={20} />
              </span>
            </Link>
          );
        })}
        {items.map((e) => (
          <Link key={e.id} to={`/exercise/${e.id}`} className={'list-item' + (exerciseOpen(e) ? '' : ' locked-tile')}>
            <span className="list-main">
              <span className="list-title">
                {L(e.title)}
                {!e.published && <span className="badge-draft">{t('content.draft')}</span>}
                {e.free && !isAdmin && <span className="badge-free">{t('content.free')}</span>}
              </span>
              <span className="muted small">{exerciseOpen(e) ? L(e.sets) : t('access.closed')}</span>
            </span>
            <span className="muted">
              <Icon name={exerciseOpen(e) ? 'chevron' : 'lock'} size={20} />
            </span>
          </Link>
        ))}
      </div>
      {!items.length && !subs.length && <p className="muted">{t('section.empty')}</p>}
    </main>
  );
}
