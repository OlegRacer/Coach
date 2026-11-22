import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import AddWorkout from '../components/AddWorkout.jsx';
import { useAuth } from '../auth/index.jsx';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { SessionList } from '../components/ScheduleParts.jsx';
import SwipePager from '../components/SwipePager.jsx';
import { iso, monthGrid, slotsOn, useSchedule } from '../lib/schedule.js';
import { useI18n } from '../i18n/index.jsx';

// Увесь місяць як календар. Угорі перемикач: мій розклад або конкретний тренер. Тап по дню показує заняття.
export default function Schedule() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { trainers, studios, slots, mine, reload } = useSchedule();
  const [adding, setAdding] = useState(false);
  const removeItem = async (s) => {
    await supabase.from('student_plan_items').delete().eq('id', s.pid);
    reload();
  };
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [who, setWho] = useState('mine');
  const [day, setDay] = useState(now);

  const tabs = ['mine', ...trainers.map((x) => x.id)];
  const ti = tabs.indexOf(who);
  const listOf = (k) => (k === 'mine' ? mine : slots.filter((x) => x.trainer_id === k));

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
    <main className="page wide sched-page">
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

      <SwipePager
        index={Math.max(0, ti)}
        count={tabs.length}
        onIndex={(i) => setWho(tabs[i])}
        renderPanel={(i) => {
          const k = tabs[i];
          const list = listOf(k);
          return (
            <>
              <section className="card sched-cal">
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
              <div className="sched-day">
      <h2 className="h2 section-title">{dayLabel}</h2>
      {k === 'mine' && !mine.length ? (
        <p className="muted">{t('sched.noMine')}</p>
      ) : (
        <SessionList items={slotsOn(list, day)} trainers={trainers} studios={studios} showStudio={k !== 'mine'} onDelete={removeItem} />
      )}
      </div>
            </>
          );
        }}
      />
      {adding && <AddWorkout onClose={() => setAdding(false)} onSaved={reload} />}
    </main>
  );
}
