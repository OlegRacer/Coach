import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getExercises, getMuscles } from '../data/api.js';

// Спрощена схема-заготовка. Пізніше замініть на повноцінний SVG:
// достатньо, щоб кожна область мала id з muscles.json і клікалась так само.
const SHAPES = [
  { id: 'shoulders', d: 'M62 58 q-14 4 -18 22 l14 4 q2 -14 12 -18z M138 58 q14 4 18 22 l-14 4 q-2 -14 -12 -18z' },
  { id: 'chest', d: 'M72 62 h56 q4 22 -6 34 h-44 q-10 -12 -6 -34z' },
  { id: 'biceps', d: 'M42 86 l14 4 -2 34 -14 -4z M158 86 l-14 4 2 34 14 -4z' },
  { id: 'triceps', d: 'M34 88 l8 -2 -2 34 -8 -2z M166 88 l-8 -2 2 34 8 -2z' },
  { id: 'abs', d: 'M78 98 h44 l-2 52 h-40z' },
  { id: 'glutes', d: 'M72 152 h56 l2 18 h-60z' },
  { id: 'quads', d: 'M72 172 h26 l-4 78 h-18z M102 172 h26 l-4 78 h-18z' },
  { id: 'back', d: 'M100 40 l0 0' }
];

export default function Anatomy() {
  const { t, tEx } = useI18n();
  const [params, setParams] = useSearchParams();
  const selected = params.get('m');
  const [muscles, setMuscles] = useState([]);
  const [items, setItems] = useState([]);

  useEffect(() => {
    getMuscles().then(setMuscles);
  }, []);
  useEffect(() => {
    if (selected) getExercises({ muscle: selected }).then(setItems);
    else setItems([]);
  }, [selected]);

  const pick = (id) => setParams(id === selected ? {} : { m: id });
  const current = muscles.find((m) => m.id === selected);

  return (
    <main className="page">
      <TopBar title={t('anatomy.title')} />

      <div className="card">
        <svg viewBox="0 0 200 270" className="body-svg" role="img" aria-label={t('anatomy.bodyAria')}>
          <circle cx="100" cy="30" r="16" fill="#22242A" />
          <rect x="88" y="44" width="24" height="12" fill="#22242A" />
          {SHAPES.filter((s) => s.id !== 'back').map((s) => (
            <path
              key={s.id}
              d={s.d}
              className={'muscle' + (selected === s.id ? ' active' : '')}
              onClick={() => pick(s.id)}
            />
          ))}
        </svg>
        <p className="muted small">{t('anatomy.tap')}</p>
        <div className="chips">
          {muscles.map((m) => (
            <button
              key={m.id}
              type="button"
              className={'chip' + (selected === m.id ? ' active' : '')}
              onClick={() => pick(m.id)}
            >
              {t(`muscle.${m.id}`)}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <section className="stack">
          <h2 className="h2 section-title">{t('anatomy.exercisesFor', { name: current ? t(`muscle.${current.id}`) : '' })}</h2>
          <div className="list">
            {items.map((e) => (
              <Link key={e.id} to={`/exercise/${e.id}`} className="list-item">
                <span className="list-main">
                  <span className="list-title">{tEx(e, 'title')}</span>
                  <span className="muted small">{tEx(e, 'sets')}</span>
                </span>
              </Link>
            ))}
          </div>
          {!items.length && <p className="muted">{t('anatomy.noExercises')}</p>}
        </section>
      )}
    </main>
  );
}
