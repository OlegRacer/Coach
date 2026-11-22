import { useRef, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import AddWorkout from './AddWorkout.jsx';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { WeekStrip, SessionList } from './ScheduleParts.jsx';
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
  const [dir, setDir] = useState('');
  const touch = useRef(null);

  const activeTrainer = trainerId && trainers.some((x) => x.id === trainerId) ? trainerId : trainers[0] && trainers[0].id;
  const trainerSlots = slots.filter((s) => s.trainer_id === activeTrainer);
  const ti = trainers.findIndex((x) => x.id === activeTrainer);
  const pickTrainer = (id) => {
    const j = trainers.findIndex((x) => x.id === id);
    if (j === ti) return;
    setDir(j > ti ? 'l' : 'r');
    setTrainerId(id);
  };
  // Свайп по зоні розкладу тренера: наступний/попередній тренер; з першого тренера вправо — назад до «Мій розклад»
  const zone = {
    onTouchStart: (e) => { const p = e.touches[0]; touch.current = { x: p.clientX, y: p.clientY }; },
    onTouchEnd: (e) => {
      const s0 = touch.current;
      touch.current = null;
      if (!s0) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - s0.x;
      const dy = p.clientY - s0.y;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      const j = ti + (dx < 0 ? 1 : -1);
      if (j < 0) goTo(0);
      else if (j < trainers.length) pickTrainer(trainers[j].id);
    }
  };

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
                  <button key={x.id} type="button" className={'chip' + (x.id === activeTrainer ? ' active' : '')} onClick={() => pickTrainer(x.id)}>
                    {x.name}
                  </button>
                ))}
              </div>
              <div key={activeTrainer} className={'tr-zone' + (dir ? ' sw-' + dir : '')} {...zone}>
                <WeekStrip slots={trainerSlots} selected={dayTr} onSelect={setDayTr} />
                <div className="w-sessions"><SessionList items={slotsOn(trainerSlots, dayTr)} trainers={trainers} studios={studios} showStudio /></div>
              </div>
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
