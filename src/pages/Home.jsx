import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import useOnline from '../lib/useOnline.js';
import { getSchedule, CATEGORIES } from '../data/api.js';
import { DAY_SHORT, DAY_LONG, currentWeek, weekdayOf, nextSession } from '../lib/dates.js';

const TILES = [
  { to: '/section/fitness', icon: 'barbell', color: '#C6F432', ...CATEGORIES.fitness },
  { to: '/section/mfr', icon: 'roller', color: '#FF8A5B', ...CATEGORIES.mfr },
  { to: '/section/mobility', icon: 'mobility', color: '#8FD3FF', ...CATEGORIES.mobility },
  { to: '/anatomy', icon: 'anatomy', color: '#C9B8FF', title: 'Анатомія тіла', hint: "М'язи та вправи для них" }
];

export default function Home() {
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
  const dateLabel = now.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  const weekLabel = `${week[0].getDate()} – ${week[6].getDate()} ${week[6].toLocaleDateString('uk-UA', { month: 'long' })}`;

  return (
    <main className="page">
      <div className="head">
        <div>
          <div className="muted small">Сьогодні, {dateLabel}</div>
          <h1 className="title">Тренування</h1>
        </div>
        {!online && (
          <div className="pill">
            <Icon name="wifiOff" size={16} /> Офлайн
          </div>
        )}
      </div>

      <section className="card" aria-label="Розклад тренувань">
        <div className="row between">
          <h2 className="h2">Мій розклад</h2>
          <span className="muted small">{weekLabel}</span>
        </div>

        <div className="week">
          {week.map((d, i) => {
            const num = i + 1;
            const isToday = num === todayNum;
            return (
              <div key={num} className={'day' + (isToday ? ' today' : '')}>
                <span className="day-name">{DAY_SHORT[i]}</span>
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
              <span>{next.session.duration} хв</span>
            </div>
            <div>
              <div className="session-title">{next.session.title}</div>
              <div className="muted small">
                {next.delta === 0 ? 'Сьогодні' : DAY_LONG[next.session.day - 1]} · {next.session.place}
              </div>
            </div>
          </div>
        )}

        <Link to="/schedule" className="btn-primary">
          Весь розклад <Icon name="arrow" size={18} />
        </Link>
      </section>

      <h2 className="h2 section-title">Розділи</h2>
      <div className="tiles">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to} className="tile">
            <span className="tile-icon" style={{ background: t.color }}>
              <Icon name={t.icon} size={32} />
            </span>
            <span className="tile-text">
              <span className="tile-title">{t.title}</span>
              <span className="muted small">{t.hint}</span>
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
