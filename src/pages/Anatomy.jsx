import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { useI18n } from '../i18n/index.jsx';
import { getExercises, getMuscles } from '../data/api.js';

import bodyImg from '../assets/body.webp';
import regions from '../data/bodyRegions.json';
import zoneMap from '../data/bodyZones.json';

const REGION = Object.fromEntries(regions.regions.map((r) => [r.id, r.d]));

// Картинка розрізана на 99 областей (src/data/bodyRegions.json, id r00…r98).
// src/data/bodyZones.json каже, з яких областей складається кожен м'яз з muscles.json.
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
        <div className="body-fig">
          <img src={bodyImg} width={regions.width} height={regions.height} alt={t('anatomy.bodyAria')} draggable="false" />
          <svg viewBox={`0 0 ${regions.width} ${regions.height}`} className="body-glow" aria-hidden="true">
            <defs>
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {Object.entries(zoneMap.zones).map(([id, ids]) => {
              const paths = ids.map((r) => REGION[r]).filter(Boolean);
              const on = selected === id;
              return (
                <g key={id} className={'zone' + (on ? ' on' : '')} onClick={() => pick(id)}>
                  {paths.map((d, i) => (
                    <path key={'g' + i} d={d} className="zone-glow" filter="url(#glow)" />
                  ))}
                  {paths.map((d, i) => (
                    <path key={'f' + i} d={d} className="zone-fill" />
                  ))}
                  {paths.map((d, i) => (
                    <path key={'l' + i} d={d} className="zone-line" />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
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
