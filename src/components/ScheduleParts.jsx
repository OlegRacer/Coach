import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { currentWeek, weekdayOf } from '../lib/dates.js';
import { iso, slotsOn } from '../lib/schedule.js';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../auth/index.jsx';

// Смужка тижня: тап по дню вибирає його.
export function WeekStrip({ slots, selected, onSelect }) {
  const { t } = useI18n();
  const today = new Date();
  const week = currentWeek(today);
  return (
    <div className="week">
      {week.map((d, i) => {
        const isToday = iso(d) === iso(today);
        const isSel = iso(d) === iso(selected);
        const busy = slotsOn(slots, d).length > 0;
        return (
          <button
            key={i}
            type="button"
            className={'day' + (isToday ? ' today' : '') + (isSel ? ' sel' : '')}
            aria-pressed={isSel}
            onClick={() => onSelect(d)}
          >
            <span className="day-name">{t(`day.short.${weekdayOf(d)}`)}</span>
            <span className="day-num">{d.getDate()}</span>
            <span className={'dot' + (busy ? ' on' : '')} />
          </button>
        );
      })}
    </div>
  );
}

// Перелік занять на день
export function SessionList({ items, trainers, studios = [], showStudio, empty, onDelete }) {
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  if (!items.length) return <p className="muted small">{empty || t('sched.noSessions')}</p>;
  const name = (id) => (trainers.find((x) => x.id === id) || {}).name;
  return (
    <div className="stack" style={{ gap: 10 }}>
      {items.map((s) => (
        <div key={s.id} className={'session' + (s.moved ? ' is-moved' : '')}>
          <div className="session-time">
            {s.personal ? (
              <b>{s.start_time === '00:00' ? t('aw.anyTime') : s.start_time}</b>
            ) : (
              <>
                <b>{s.start_time}</b>
                <span>{t('common.minutes', { n: s.duration_min })}</span>
              </>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="session-title">{s.to ? <Link to={s.to}>{s.title}</Link> : s.title}{s.moved && <span className="badge-moved">{t('sa.moved')}</span>}</div>
            <div className="muted small">{[showStudio ? (studios.find((g) => g.id === s.studio_id) || {}).name || name(s.trainer_id) : name(s.trainer_id), s.place].filter(Boolean).join(' · ')}</div>
          </div>
          {isAdmin && !s.personal && (
            <Link className="icon-btn" to={`/admin/schedule?edit=${String(s.id).split('@')[0]}`} aria-label={t('sa.edit')}>
              <Icon name="edit" size={22} />
            </Link>
          )}
          {s.personal && onDelete && (
            <button type="button" className="icon-btn trash-btn" aria-label={t('sa.delete')} onClick={() => onDelete(s)}>
              <Icon name="trash" size={22} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
