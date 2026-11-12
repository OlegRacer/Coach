import { Link, useSearchParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

import bodyImg from '../assets/body.webp';
import litImg from '../assets/body-lit.webp';
import regions from '../data/bodyRegions.json';
import { GROUPS, LEAVES, expand, leavesOfGroup, muscleName } from '../lib/muscles.js';

const REGION = Object.fromEntries(regions.regions.map((r) => [r.id, r.d]));
const CLIP = Object.fromEntries(regions.regions.map((r) => [r.id, r.c || r.d]));

// Картинка розрізана на 99 областей (src/data/bodyRegions.json, id r00…r98).
// src/data/muscles.json каже, з яких областей складається кожна зона: групи (руки, плечі…) і півзони (біцепс, передня дельта…).
// Можна вибрати кілька зон одразу, з різних груп. Вибір зберігається в адресі: ?m=biceps,chest.
export default function Anatomy() {
  const { t } = useI18n();
  const { exercisesByMuscles, sectionOpen } = useContent();
  const L = useL();
  const { ready } = useAuth();
  const [params, setParams] = useSearchParams();
  // Вибрані «листки» (найдрібніші зони). ?m= може містити і групу, вона розгортається в півзони.
  const sel = expand((params.get('m') || '').split(',').filter(Boolean));
  const items = sel.size ? exercisesByMuscles([...sel]) : [];

  const save = (set) => setParams(set.size ? { m: [...set].join(',') } : {}, { replace: true });
  const toggleLeaf = (id) => {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    save(n);
  };
  const toggleGroup = (g) => {
    const ids = leavesOfGroup(g.id);
    const all = ids.every((x) => sel.has(x));
    const n = new Set(sel);
    ids.forEach((x) => (all ? n.delete(x) : n.add(x)));
    save(n);
  };
  const names = LEAVES.filter((l) => sel.has(l.id)).map((l) => muscleName(t, l.id));

  if (!ready) return <main className="page" />;
  if (!sectionOpen('anatomy')) return <Locked section="anatomy" title={t('anatomy.title')} />;

  return (
    <main className="page wide anatomy-page">
      <TopBar title={t('anatomy.title')} />

      <div className="card anat-card" style={{ '--ar': regions.width / regions.height }}>
        <div className="anat-fig">
        <div className="body-fig">
          <img src={bodyImg} width={regions.width} height={regions.height} alt={t('anatomy.bodyAria')} draggable="false" />
          <svg viewBox={`0 0 ${regions.width} ${regions.height}`} className="body-glow" aria-hidden="true">
            <defs>
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {LEAVES.map((leaf) => {
              const on = sel.has(leaf.id);
              const glow = leaf.regions.map((r) => REGION[r]).filter(Boolean);
              const clip = leaf.regions.map((r) => CLIP[r]).filter(Boolean);
              return (
                <g key={leaf.id} className={'zone' + (on ? ' on' : '')} onClick={() => toggleLeaf(leaf.id)}>
                  <clipPath id={`clip-${leaf.id}`}>
                    {clip.map((d, i) => (
                      <path key={i} d={d} />
                    ))}
                  </clipPath>
                  {glow.map((d, i) => (
                    <path key={'g' + i} d={d} className="zone-glow" filter="url(#glow)" />
                  ))}
                  <image href={litImg} width={regions.width} height={regions.height} className="zone-lit" clipPath={`url(#clip-${leaf.id})`} />
                </g>
              );
            })}
          </svg>
        </div>
        </div>
        <div className="anat-ctrl">
        <p className="muted small">{t('anatomy.tapMulti')}</p>
        <div className="muscle-groups">
          {GROUPS.map((g) => {
            const ids = leavesOfGroup(g.id);
            const all = ids.every((x) => sel.has(x));
            const some = ids.some((x) => sel.has(x));
            return (
              <div key={g.id} className={'muscle-group' + (all ? ' all' : some ? ' some' : '')}>
                <button
                  type="button"
                  className={'chip' + (all ? ' active' : some ? ' partial' : '')}
                  aria-pressed={all}
                  onClick={() => toggleGroup(g)}
                >
                  {t(`muscle.${g.id}`)}
                </button>
                {(g.parts || []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={'chip chip-sub' + (sel.has(p.id) ? ' active' : '')}
                    aria-pressed={sel.has(p.id)}
                    onClick={() => toggleLeaf(p.id)}
                  >
                    {t(`muscle.${p.id}`)}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
        {sel.size > 0 && (
          <button type="button" className="link-btn" onClick={() => save(new Set())}>
            {t('anatomy.clear')}
          </button>
        )}
        </div>
      </div>

      {sel.size > 0 && (
        <section className="stack">
          <h2 className="h2 section-title">{t('anatomy.exercisesFor', { name: names.join(', ') })}</h2>
          <div className="list">
            {items.map((e) => (
              <Link key={e.id} to={`/exercise/${e.id}`} className="list-item">
                <span className="list-main">
                  <span className="list-title">{L(e.title)}</span>
                  <span className="muted small">{L(e.sets)}</span>
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
