import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Media from '../components/Media.jsx';
import YouTubePlayer from '../components/YouTubePlayer.jsx';
import { videosOf } from '../lib/video.js';
import { isKnown, muscleName } from '../lib/muscles.js';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL, mediaUrl } from '../lib/content.jsx';
import { useEquipment } from '../lib/equipment.jsx';

const hasText = (o) => !!o && Object.values(o).some((x) => String(x || '').trim());

export default function Exercise() {
  const { id } = useParams();
  const { t } = useI18n();
  const { ready, isAdmin } = useAuth();
  const { exercise, exerciseOpen } = useContent();
  const { byId, needed, missing } = useEquipment();
  const L = useL();
  const ex = exercise(id);
  const [vi, setVi] = useState(0);
  const videos = videosOf(ex);
  const vcur = Math.min(vi, Math.max(0, videos.length - 1));

  if (!ex) {
    return (
      <main className="page">
        <TopBar title={t('exercise.title')} />
        <p className="muted">{t('exercise.notFound')}</p>
      </main>
    );
  }

  if (!ready) return <main className="page" />;
  if (!exerciseOpen(ex)) return <Locked section={ex.section_id} title={t('exercise.title')} />;

  const list = (ex.muscles || []).filter(isKnown);
  const title = L(ex.title);
  const need = needed(ex);
  const lack = missing(ex);

  return (
    <main className="page wide ex-page">
      <TopBar title={title} to={`/section/${ex.section_id}`} />
      {!ex.published && <div className="pill draft-pill">{t('content.draft')}</div>}

      {ex.preview && <Media src={mediaUrl(ex.preview)} title={title} />}

      {(hasText(ex.sets) || hasText(ex.description)) && (
        <section className="card">
          {hasText(ex.sets) && (
            <div className="row between">
              <h2 className="h2">{t('exercise.sets')}</h2>
              <b>{L(ex.sets)}</b>
            </div>
          )}
          {hasText(ex.description) && <p className="body pre">{L(ex.description)}</p>}
        </section>
      )}

      {need.length > 0 && (
        <section className="card">
          <h2 className="h2">{t('equip.needed')}</h2>
          <div className="chips">
            {need.map((id) => (
              <span key={id} className={'chip equip-chip' + (!isAdmin && lack.includes(id) ? ' chip-missing' : '')}>
                <span aria-hidden="true">{byId[id].icon}</span> {L(byId[id].name)}
              </span>
            ))}
          </div>
          {!isAdmin && lack.length > 0 && (
            <p className="small equip-warn">
              {t('equip.missing', { list: lack.map((id) => L(byId[id].name)).join(', ') })}{' '}
              <Link to="/equipment" className="link-btn">{t('equip.mark')}</Link>
            </p>
          )}
        </section>
      )}

      {list.length > 0 && (
        <section className="card">
          <h2 className="h2">{t('exercise.muscles')}</h2>
          <div className="chips">
            {list.map((id) => (
              <Link key={id} to={`/anatomy?m=${id}`} className="chip">
                {muscleName(t, id)}
              </Link>
            ))}
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section className="stack">
          <h2 className="h2 section-title">{t('exercise.video')}</h2>
          {videos.length > 1 && (
            <div className="chips">
              {videos.map((v, i) => (
                <button type="button" key={i} className={'chip' + (vcur === i ? ' active' : '')} aria-pressed={vcur === i} onClick={() => setVi(i)}>
                  {L(v.label) || `${t('exercise.video')} ${i + 1}`}
                </button>
              ))}
            </div>
          )}
          <YouTubePlayer key={vcur + ':' + videos[vcur].id} video={videos[vcur]} title={L(videos[vcur].label)} />
        </section>
      )}
    </main>
  );
}
