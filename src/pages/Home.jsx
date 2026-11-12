import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import SettingsSheet from '../components/SettingsSheet.jsx';
import useOnline from '../lib/useOnline.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import ScheduleWidget from '../components/ScheduleWidget.jsx';
import { useContent, useL } from '../lib/content.jsx';

export default function Home() {
  const { t, locale } = useI18n();
  const online = useOnline();
  const { isAdmin, access } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sorting, setSorting] = useState(false);
  const { sections, setOrder, sectionOpen, openCount, isFreeSection } = useContent();
  const L = useL();
  const move = (i, d) => {
    const ids = sections.map((x) => x.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setOrder(ids);
  };

  const now = new Date();
  const dateLabel = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  return (
    <main className="page wide">
      <div className="head">
        <div>
          <div className="muted small">{t('home.todayDate', { date: dateLabel })}</div>
          <h1 className="title">{t('home.title')}</h1>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label={t('settings.title')}
          aria-haspopup="dialog"
          onClick={() => setSettingsOpen(true)}
        >
          <Icon name="settings" size={24} />
        </button>
      </div>

      {!online && (
        <div className="pill">
          <Icon name="wifiOff" size={16} /> {t('common.offline')}
        </div>
      )}

      <div className="home-grid">
      <div className="home-sched">
        <ScheduleWidget />
      </div>
      <div className="home-sections stack">
      <div className="row between">
        <h2 className="h2 section-title">{t('home.sections')}</h2>
        {sections.length > 1 && (
          <button type="button" className="link-btn" onClick={() => setSorting((v) => !v)}>
            {sorting ? t('content.sortDone') : t('content.sort')}
          </button>
        )}
      </div>
      <div className="tiles">
        {sections.map((x, i) => {
          const full = sectionOpen(x.id);
          const partN = !full && x.kind !== 'anatomy' ? openCount(x.id) : 0;
          const open = full || partN > 0;
          const until = !isAdmin && full && access[x.id]
            ? new Date(access[x.id]).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
            : '';
          const to = x.kind === 'anatomy' ? '/anatomy' : `/section/${x.id}`;
          const hint = L(x.hint);
          const sub = !x.published ? t('content.draft') : isFreeSection(x.id) ? t('content.free') : partN > 0 ? t('access.partial', { n: partN }) : open ? (until ? t('access.until', { date: until }) : hint) : t('access.closed');
          const body = (
            <>
              <span className="tile-icon" style={{ background: x.color }}>
                <Icon name={x.icon} size={32} />
              </span>
              <span className="tile-text">
                <span className="tile-title">{L(x.title)}</span>
                <span className={'muted small' + (x.published ? '' : ' draft')}>{sub}</span>
              </span>
            </>
          );
          if (sorting) {
            return (
              <div key={x.id} className="tile sorting">
                {body}
                <span className="sort-btns">
                  <button type="button" className="icon-btn" aria-label="↑" disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon name="up" size={20} />
                  </button>
                  <button type="button" className="icon-btn" aria-label="↓" disabled={i === sections.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="down" size={20} />
                  </button>
                </span>
              </div>
            );
          }
          return (
            <Link key={x.id} to={to} className={'tile' + (open ? '' : ' locked-tile')}>
              {body}
              <span className="muted">
                <Icon name={open ? 'chevron' : 'lock'} size={22} />
              </span>
            </Link>
          );
        })}
      </div>
      </div>
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
