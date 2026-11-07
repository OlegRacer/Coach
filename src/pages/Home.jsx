import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';
import useOnline from '../lib/useOnline.js';
import { useI18n } from '../i18n/index.jsx';
import { getSchedule } from '../data/api.js';
import { currentWeek, weekdayOf, nextSession } from '../lib/dates.js';

const TILES = [
  { to: '/section/fitness', icon: 'barbell', color: '#C6F432', title: 'cat.fitness.title', hint: 'cat.fitness.hint' },
  { to: '/section/mfr', icon: 'roller', color: '#FF8A5B', title: 'cat.mfr.title', hint: 'cat.mfr.hint' },
  { to: '/section/mobility', icon: 'mobility', color: '#8FD3FF', title: 'cat.mobility.title', hint: 'cat.mobility.hint' },
  { to: '/anatomy', icon: 'anatomy', color: '#C9B8FF', title: 'anatomy.title', hint: 'anatomy.hint' }
];

export default function Home() {
  const { t, locale } = useI18n();
  const online = useOnline();
  const [schedule, setSchedule] = useState([]);
  useEffect(() => {
    getSchedule().then(setSchedule);
  }, []);

  const now = new Date();
  const week = currentWeek(now);
  const todayNum = weekdayOf(now);
  const busyDays = new Set(schedule.map((s) => s.day));
  const next = schedule.length ? nextSession(schedule, now) : null;
  const dateLabel = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  const short = (d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  return (
    <main className="page">
      <div className="head">
        <div>
          <div className="muted small">{t('home.todayDate', { date: dateLabel })}</div>
          <h1 className="title">{t('home.title')}</h1>
        </div>
        <LangSwitcher />
      </div>

      {!online && (
        <div className="pill">
          <Icon name="wifiOff" size={16} /> {t('common.offline')}
        </div>
      )}

      <section className="card" aria-label={t('home.scheduleAria')}>
        <div className="row between">
          <h2 className="h2">{t('home.schedule')}</h2>
          <span className="muted small">
            {short(week[0])} – {short(week[6])}
          </span>
        </div>

        <div className="week">
          {week.map((d, i) => {
            const num = i + 1;
            const isToday = num === todayNum;
            return (
              <div key={num} className={'day' + (isToday ? ' today' : '')}>
                <span className="day-name">{t(`day.short.${num}`)}</span>
                <span className="day-num">{d.getDate()}</span>
                <span className={'dot' + (busyDays.has(num) ? ' on' : '')} />
              </div>
            );
          })}
        </div>

        {next && (
          <div className="session">
            <div className="session-time">
              <b>{next.session.time}</b>
              <span>{t('common.minutes', { n: next.session.duration })}</span>
            </div>
            <div>
              <div className="session-title">{t(next.session.title)}</div>
              <div className="muted small">
                {next.delta === 0 ? t('common.today') : t(`day.long.${next.session.day}`)} · {t(next.session.place)}
              </div>
            </div>
          </div>
        )}

        <Link to="/schedule" className="btn-primary">
          {t('home.fullSchedule')} <Icon name="arrow" size={18} />
        </Link>
      </section>

      <h2 className="h2 section-title">{t('home.sections')}</h2>
      <div className="tiles">
        {TILES.map((x) => (
          <Link key={x.to} to={x.to} className="tile">
            <span className="tile-icon" style={{ background: x.color }}>
              <Icon name={x.icon} size={32} />
            </span>
            <span className="tile-text">
              <span className="tile-title">{t(x.title)}</span>
              <span className="muted small">{t(x.hint)}</span>
            </span>
            <span className="muted">
              <Icon name="chevron" size={22} />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
