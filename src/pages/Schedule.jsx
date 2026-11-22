import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import AddWorkout from '../components/AddWorkout.jsx';
import { useAuth } from '../auth/index.jsx';
import TopBar from '../components/TopBar.jsx';
import Icon from '../components/Icon.jsx';
import { SessionList } from '../components/ScheduleParts.jsx';
import SwipePager from '../components/SwipePager.jsx';
import { iso, monthGrid, slotsOn, useSchedule } from '../lib/schedule.js';
import { useI18n } from '../i18n/index.jsx';

// Широкий екран або телефон набік: дві плитки, як віджет на головній
function useWide() {
  const q = '(min-width: 720px)';
  const [w, setW] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setW(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return w;
}

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
  const wide = useWide();
  const [trainerId, setTrainerId] = useState(null);
  const activeTr = trainerId && trainers.some((x) => x.id === trainerId) ? trainerId : trainers[0] && trainers[0].id;
  const tri = Math.max(0, trainers.findIndex((x) => x.id === activeTr));

  const cells = monthGrid(ym.y, ym.m);
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const move = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
    setDay(d);
  };
  const dayLabel = day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const todayKey = iso(now);

  // місяць-календар для певного списку занять (крапки під днями)
  const calendar = (list) => (
    <>
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
    </>
  );
  const sessions = (k, list) =>
    k === 'mine' && !mine.length ? (
      <p className="muted">{t('sched.noMine')}</p>
    ) : (
      <SessionList items={slotsOn(list, day)} trainers={trainers} studios={studios} showStudio={k !== 'mine'} onDelete={removeItem} />
    );

  return (
    <main className="page wide sched-page">
      <TopBar title={t('schedule.title')} />

      {!wide ? (
        <>
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
                  <section className="card sched-cal">{calendar(list)}</section>
                  <div className="sched-day">
                    <h2 className="h2 section-title">{dayLabel}</h2>
                    {sessions(k, list)}
                  </div>
                </>
              );
            }}
          />
        </>
      ) : (
        <div className="sched-tiles">
          <section className="card sched-tile">
            <h2 className="h2">{t('home.schedule')}</h2>
            <div className="sched-tile-cal">{calendar(mine)}</div>
            <h3 className="sched-daylabel">{dayLabel}</h3>
            <div className="w-sessions">{sessions('mine', mine)}</div>
          </section>
          <section className="card sched-tile">
            <h2 className="h2">{t('sched.trainers')}</h2>
            {!trainers.length ? (
              <p className="muted small">{t('sched.noTrainers')}</p>
            ) : (
              <>
                <div className="chips">
                  {trainers.map((x) => (
                    <button key={x.id} type="button" className={'chip' + (x.id === activeTr ? ' active' : '')} onClick={() => setTrainerId(x.id)}>
                      {x.name}
                    </button>
                  ))}
                </div>
                <SwipePager
                  index={tri}
                  count={trainers.length}
                  onIndex={(i) => setTrainerId(trainers[i].id)}
                  renderPanel={(i) => {
                    const list = listOf(trainers[i].id);
                    return (
                      <>
                        <div className="sched-tile-cal">{calendar(list)}</div>
                        <h3 className="sched-daylabel">{dayLabel}</h3>
                        <div className="w-sessions">{sessions(trainers[i].id, list)}</div>
                      </>
                    );
                  }}
                />
              </>
            )}
          </section>
        </div>
      )}
      {adding && <AddWorkout onClose={() => setAdding(false)} onSaved={reload} />}
    </main>
  );
}
