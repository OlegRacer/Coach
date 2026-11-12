import { useState } from 'react';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { SessionList } from '../components/ScheduleParts.jsx';
import { iso, monthGrid, slotsOn, useSchedule } from '../lib/schedule.js';
import { useI18n } from '../i18n/index.jsx';

// Увесь місяць як календар. Угорі перемикач: мій розклад або конкретний тренер. Тап по дню показує заняття.
export default function Schedule() {
  const { t, locale } = useI18n();
  const { trainers, slots, mine } = useSchedule();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [who, setWho] = useState('mine');
  const [day, setDay] = useState(now);

  const list = who === 'mine' ? mine : slots.filter((s) => s.trainer_id === who);
  const cells = monthGrid(ym.y, ym.m);
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const move = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setDay(d);
  };
  const dayLabel = day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const todayKey = iso(now);

  return (
    <main className="page">
      <TopBar title={t('schedule.title')} />

      <div className="chips">
        <button type="button" className={'chip' + (who === 'mine' ? ' active' : '')} onClick={() => setWho('mine')}>
          {t('home.schedule')}
        </button>
        {trainers.map((x) => (
          <button key={x.id} type="button" className={'chip' + (who === x.id ? ' active' : '')} onClick={() => setWho(x.id)}>
            {x.name}
          </button>
        ))}
      </div>

      <section className="card">
        <div className="row between">
          <button type="button" className="icon-btn small-btn" onClick={() => move(-1)} aria-label={t('sched.prevMonth')}>
            <Icon name="back" size={20} />
          </button>
          <h2 className="h2 month-label">{label}</h2>
          <button type="button" className="icon-btn small-btn" onClick={() => move(1)} aria-label={t('sched.nextMonth')}>
            <Icon name="chevron" size={20} />
          </button>
        </div>

        <div className="month-head" aria-hidden="true">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <span key={n}>{t(`day.short.${n}`)}</span>
          ))}
        </div>
        <div className="month">
          {cells.map((d, i) =>
            d ? (
              <button
                key={i}
                type="button"
                className={'mday' + (iso(d) === todayKey ? ' today' : '') + (iso(d) === iso(day) ? ' sel' : '')}
                aria-pressed={iso(d) === iso(day)}
                onClick={() => setDay(d)}
              >
                <span>{d.getDate()}</span>
                <span className={'dot' + (slotsOn(list, d).length ? ' on' : '')} />
              </button>
            ) : (
              <span key={i} />
            )
          )}
        </div>
      </section>

      <h2 className="h2 section-title">{dayLabel}</h2>
      {who === 'mine' && !mine.length ? (
        <p className="muted">{t('sched.noMine')}</p>
      ) : (
        <SessionList items={slotsOn(list, day)} trainers={trainers} />
      )}
    </main>
  );
}
