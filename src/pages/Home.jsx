import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import SettingsSheet from '../components/SettingsSheet.jsx';
import useOnline from '../lib/useOnline.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import ScheduleWidget from '../components/ScheduleWidget.jsx';

const TILES = [
  { key: 'fitness', to: '/section/fitness', icon: 'barbell', color: '#C6F432', title: 'cat.fitness.title', hint: 'cat.fitness.hint' },
  { key: 'mfr', to: '/section/mfr', icon: 'roller', color: '#FF8A5B', title: 'cat.mfr.title', hint: 'cat.mfr.hint' },
  { key: 'mobility', to: '/section/mobility', icon: 'mobility', color: '#8FD3FF', title: 'cat.mobility.title', hint: 'cat.mobility.hint' },
  { key: 'anatomy', to: '/anatomy', icon: 'anatomy', color: '#C9B8FF', title: 'anatomy.title', hint: 'anatomy.hint' }
];

export default function Home() {
  const { t, locale } = useI18n();
  const online = useOnline();
  const { isAdmin, access, hasAccess } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const now = new Date();
  const dateLabel = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  return (
    <main className="page">
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

      <ScheduleWidget />

      <h2 className="h2 section-title">{t('home.sections')}</h2>
      <div className="tiles">
        {TILES.map((x) => {
          const open = hasAccess(x.key);
          const until = !isAdmin && open && access[x.key]
            ? new Date(access[x.key]).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
            : '';
          return (
            <Link key={x.to} to={x.to} className={'tile' + (open ? '' : ' locked-tile')}>
              <span className="tile-icon" style={{ background: x.color }}>
                <Icon name={x.icon} size={32} />
              </span>
              <span className="tile-text">
                <span className="tile-title">{t(x.title)}</span>
                <span className="muted small">
                  {open ? (until ? t('access.until', { date: until }) : t(x.hint)) : t('access.closed')}
                </span>
              </span>
              <span className="muted">
                <Icon name={open ? 'chevron' : 'lock'} size={22} />
              </span>
            </Link>
          );
        })}
      </div>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
