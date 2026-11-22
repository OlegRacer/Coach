import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import AddWorkout from './AddWorkout.jsx';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { WeekStrip, SessionList } from './ScheduleParts.jsx';
import SwipePager from './SwipePager.jsx';
import { currentWeek } from '../lib/dates.js';
import { nextOccurrence, slotsOn, useSchedule } from '../lib/schedule.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../auth/index.jsx';

// «Віджет» розкладу: свайп вліво/вправо перемикає блоки. 1) Мій розклад, 2) Тренери.
export default function ScheduleWidget({ mineOnly = false }) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const { trainers, studios, slots, mine, reload } = useSchedule();
  const [adding, setAdding] = useState(false);
  const removeItem = async (s) => {
    await supabase.from('student_plan_items').delete().eq('id', s.pid);
    reload();
  };
  const track = useRef(null);
  const [page, setPage] = useState(0);
  const [dayMine, setDayMine] = useState(new Date());
  const [dayTr, setDayTr] = useState(new Date());
  const [trainerId, setTrainerId] = useState(null);

  const activeTrainer = trainerId && trainers.some((x) => x.id === trainerId) ? trainerId : trainers[0] && trainers[0].id;
  const ti = Math.max(0, trainers.findIndex((x) => x.id === activeTrainer));

  const week = currentWeek(new Date());
  const short = (d) => d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const range = `${short(week[0])} – ${short(week[6])}`;

  const onScroll = () => {
    const el = track.current;
    if (el) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // зовнішній перехід між плитками: тільки горизонтальний свайп (не по діагоналі), без нативного скролу
  const pageRef = useRef(0);
  pageRef.current = page;
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    let g = null;
    const start = (e) => {
      g = e.target.closest && e.target.closest('.swp') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    };
    const end = (e) => {
      if (!g) return;
      const mx = e.changedTouches[0].clientX - g.x;
      const my = e.changedTouches[0].clientY - g.y;
      const fast = Math.abs(mx) / Math.max(1, Date.now() - g.t) > 0.45;
      g = null;
      if (Math.abs(mx) < 30 || Math.abs(mx) < Math.abs(my) * 2.5) return;
      if (!(Math.abs(mx) > el.clientWidth * 0.22 || fast)) return;
      const n = Math.max(0, Math.min(1, pageRef.current + (mx < 0 ? 1 : -1)));
      el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', end, { passive: true });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchend', end); };
  }, []);

  const next = mine.length ? nextOccurrence(mine) : null;
  const dayItems = slotsOn(mine, dayMine);
  const nextText = next
    ? t('sched.next', {
        when: `${next.delta === 0 ? t('common.today') : t(`day.long.${next.date.getDay() === 0 ? 7 : next.date.getDay()}`)}${next.slot.personal && next.slot.start_time === '00:00' ? '' : ', ' + next.slot.start_time}`,
        title: next.slot.title
      })
    : '';

  return (
    <section className={'card widget' + (mineOnly ? ' mine-only' : '')} aria-label={t('home.scheduleAria')}>
      <div className="widget-track" ref={track} onScroll={onScroll}>
        <div className="widget-page" aria-hidden={page !== 0}>
          <div className="row between">
            <h2 className="h2">{t('home.schedule')}</h2>
            <span className="muted small">{range}</span>
          </div>
          <WeekStrip slots={mine} selected={dayMine} onSelect={setDayMine} />
          {!mine.length ? (
            <div className="w-sessions"><p className="muted small">{t('sched.noMine')}</p></div>
          ) : (
            <div className="w-sessions">
              <SessionList items={dayItems} trainers={trainers} onDelete={removeItem} />
              {!dayItems.length && nextText && <p className="small">{nextText}</p>}
            </div>
          )}
        </div>

        {!mineOnly && <div className="widget-page" aria-hidden={page !== 1}>
          <div className="row between">
            <h2 className="h2">{t('sched.trainers')}</h2>
            <span className="muted small">{range}</span>
          </div>
          {!trainers.length ? (
            <p className="muted small">{t('sched.noTrainers')}</p>
          ) : (
            <>
              <div className="chips">
                {trainers.map((x) => (
                  <button key={x.id} type="button" className={'chip' + (x.id === activeTrainer ? ' active' : '')} onClick={() => setTrainerId(x.id)}>
                    {x.name}
                  </button>
                ))}
              </div>
              <SwipePager
                index={ti}
                count={trainers.length}
                onIndex={(i) => setTrainerId(trainers[i].id)}
                onEdge={(d) => d < 0 && goTo(0)}
                renderPanel={(i) => {
                  const list = slots.filter((x) => x.trainer_id === trainers[i].id);
                  return (
                    <>
                      <WeekStrip slots={list} selected={dayTr} onSelect={setDayTr} />
                      <div className="w-sessions"><SessionList items={slotsOn(list, dayTr)} trainers={trainers} studios={studios} showStudio /></div>
                    </>
                  );
                }}
              />
            </>
          )}
        </div>}
      </div>

      {!mineOnly && <div className="widget-dots" role="tablist">
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={page === i}
            aria-label={i === 0 ? t('home.schedule') : t('sched.trainers')}
            className={'wdot' + (page === i ? ' on' : '')}
            onClick={() => goTo(i)}
          />
        ))}
      </div>}

      <div className="row widget-actions" style={{ gap: 8 }}>
        <Link to="/schedule" className="btn-ghost btn-small">
          {t('home.fullSchedule')}
        </Link>
        {user && (
          <button type="button" className="btn-primary btn-small" onClick={() => setAdding(true)}>
            <Icon name="plus" size={16} /> {t('aw.add')}
          </button>
        )}
      </div>
      {adding && <AddWorkout onClose={() => setAdding(false)} onSaved={reload} />}
    </section>
  );
}
