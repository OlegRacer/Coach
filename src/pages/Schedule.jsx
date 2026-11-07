import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getSchedule } from '../data/api.js';

export default function Schedule() {
  const { t } = useI18n();
  const [schedule, setSchedule] = useState([]);
  useEffect(() => {
    getSchedule().then(setSchedule);
  }, []);

  return (
    <main className="page">
      <TopBar title={t('schedule.title')} />
      {[1, 2, 3, 4, 5, 6, 7].map((day) => {
        const items = schedule.filter((s) => s.day === day);
        if (!items.length) return null;
        return (
          <section key={day} className="card">
            <h2 className="h2">{t(`day.long.${day}`)}</h2>
            {items.map((s) => (
              <div key={s.time + s.title} className="session">
                <div className="session-time">
                  <b>{s.time}</b>
                  <span>{t('common.minutes', { n: s.duration })}</span>
                </div>
                <div>
                  <div className="session-title">{t(s.title)}</div>
                  <div className="muted small">{t(s.place)}</div>
                </div>
              </div>
            ))}
          </section>
        );
      })}
      {!schedule.length && <p className="muted">{t('schedule.empty')}</p>}
    </main>
  );
}
