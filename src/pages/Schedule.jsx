import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { getSchedule } from '../data/api.js';
import { DAY_LONG } from '../lib/dates.js';

export default function Schedule() {
  const [schedule, setSchedule] = useState([]);
  useEffect(() => {
    getSchedule().then(setSchedule);
  }, []);

  return (
    <main className="page">
      <TopBar title="Розклад" />
      {DAY_LONG.map((name, i) => {
        const items = schedule.filter((s) => s.day === i + 1);
        if (!items.length) return null;
        return (
          <section key={name} className="card">
            <h2 className="h2">{name}</h2>
            {items.map((s) => (
              <div key={s.time + s.title} className="session">
                <div className="session-time">
                  <b>{s.time}</b>
                  <span>{s.duration} хв</span>
                </div>
                <div>
                  <div className="session-title">{s.title}</div>
                  <div className="muted small">{s.place}</div>
                </div>
              </div>
            ))}
          </section>
        );
      })}
      {!schedule.length && <p className="muted">Розклад ще порожній.</p>}
    </main>
  );
}
