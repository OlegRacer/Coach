import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import TopBar from '../components/TopBar.jsx';
import Locked from '../components/Locked.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useContent, useL } from '../lib/content.jsx';

import bodyImgM from '../assets/body.webp';
import litImgM from '../assets/body-lit.webp';
import regionsM from '../data/bodyRegions.json';
import bodyImgF from '../assets/body-f.webp';
import litImgF from '../assets/body-f-lit.webp';
import regionsF from '../data/bodyRegionsF.json';
import { GROUPS, LEAVES, expand, leavesOfGroup, muscleName } from '../lib/muscles.js';

// Дві моделі: чоловіча й жіноча (вибирається за статтю з анкети). Області мають ті самі id, тож зони (muscles.json) спільні.
const build = (bodyImg, litImg, regions) => ({
  bodyImg,
  litImg,
  regions,
  REGION: Object.fromEntries(regions.regions.map((r) => [r.id, r.d])),
  CLIP: Object.fromEntries(regions.regions.map((r) => [r.id, r.c || r.d]))
});
// У жіночій моделі області r31/r32 — клубово-поперекові м'язи й кравецький м'яз (верх стегна і низ пресу): до квадрицепса їх не підсвічуємо.
const FEMALE_SKIP = { quads: ['r31', 'r32'] };
// нижні косі смужки живота підсвічуємо разом із косими м'язами
const FEMALE_ADD = { obliques: ['r31', 'r32'] };
const MALE = build(bodyImgM, litImgM, regionsM);
const FEMALE = build(bodyImgF, litImgF, regionsF);

// Картинка розрізана на 99 областей (src/data/bodyRegions.json, id r00…r98).
// src/data/muscles.json каже, з яких областей складається кожна зона: групи (руки, плечі…) і півзони (біцепс, передня дельта…).
// Можна вибрати кілька зон одразу, з різних груп. Вибір зберігається в адресі: ?m=biceps,chest.
export default function Anatomy() {
  const { t } = useI18n();
  const { exercisesByMuscles, sectionOpen } = useContent();
  const L = useL();
  const { ready, details } = useAuth();
  // Модель тіла: за замовчуванням за статтю з анкети, можна перемкнути (вибір запам'ятовується)
  const [model, setModel] = useState(() => {
    try {
      const v = localStorage.getItem('anatomy:model');
      return v === 'female' || v === 'male' ? v : '';
    } catch {
      return '';
    }
  });
  const pickModel = (v) => {
    setModel(v);
    try {
      localStorage.setItem('anatomy:model', v);
    } catch {
      /* ignore */
    }
  };
  const female = (model || (details && details.gender === 'female' ? 'female' : 'male')) === 'female';
  const { bodyImg, litImg, regions, REGION, CLIP } = female ? FEMALE : MALE;
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
  // розкриті групи: за замовчуванням ті, де вже щось вибрано
  const [rootOpen, setRootOpen] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const toggleOpen = (id) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const names = LEAVES.filter((l) => sel.has(l.id)).map((l) => muscleName(t, l.id));

  if (!ready) return <main className="page" />;
  if (!sectionOpen('anatomy')) return <Locked section="anatomy" title={t('anatomy.title')} />;

  return (
    <main className="page wide anatomy-page">
      <TopBar title={t('anatomy.title')} />

      <div className="chips anat-model" role="radiogroup" aria-label={t('anatomy.model')}>
        {['male', 'female'].map((m) => (
          <button key={m} type="button" role="radio" aria-checked={(m === 'female') === female} className={'chip' + ((m === 'female') === female ? ' active' : '')} onClick={() => pickModel(m)}>
            {t(`anatomy.${m}`)}
          </button>
        ))}
      </div>

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
              const rs = female ? [...(FEMALE_SKIP[leaf.id] ? leaf.regions.filter((r) => !FEMALE_SKIP[leaf.id].includes(r)) : leaf.regions), ...(FEMALE_ADD[leaf.id] || [])] : leaf.regions;
              const glow = rs.map((r) => REGION[r]).filter(Boolean);
              const clip = rs.map((r) => CLIP[r]).filter(Boolean);
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
        <div className="mz-root">
          <button type="button" className="mz-rhead" aria-expanded={rootOpen} onClick={() => setRootOpen((v) => !v)}>
            <span className="mz-rname">{t('anatomy.groups')}</span>
            {sel.size > 0 && <span className="mz-count muted small">{sel.size}</span>}
            <span className={'mz-chev' + (rootOpen ? ' open' : '')}>
              <Icon name="down" size={22} />
            </span>
          </button>
        {rootOpen && (
        <div className="mz-list">
          {GROUPS.map((g) => {
            const ids = leavesOfGroup(g.id);
            const cnt = ids.filter((x) => sel.has(x)).length;
            const all = cnt === ids.length;
            const parts = g.parts || [];
            const isOpen = open.has(g.id);
            return (
              <div key={g.id} className={'mz-group' + (cnt ? ' has' : '')}>
                <div className="mz-head">
                  <button type="button" className="mz-main" aria-pressed={all} onClick={() => toggleGroup(g)}>
                    <span className={'mz-box' + (all ? ' on' : cnt ? ' part' : '')} aria-hidden="true">
                      {all ? <Icon name="check" size={16} /> : cnt ? <Icon name="minus" size={16} /> : null}
                    </span>
                    <span className="mz-name">{t(`muscle.${g.id}`)}</span>
                    {cnt > 0 && parts.length > 0 && <span className="mz-count muted small">{cnt}/{ids.length}</span>}
                  </button>
                  {parts.length > 0 && (
                    <button type="button" className="mz-toggle" aria-expanded={isOpen} aria-label={t(`muscle.${g.id}`)} onClick={() => toggleOpen(g.id)}>
                      <span className={'mz-chev' + (isOpen ? ' open' : '')}>
                        <Icon name="down" size={20} />
                      </span>
                    </button>
                  )}
                </div>
                {isOpen && parts.length > 0 && (
                  <div className="mz-subs">
                    {parts.map((p) => (
                      <button key={p.id} type="button" className="mz-sub" aria-pressed={sel.has(p.id)} onClick={() => toggleLeaf(p.id)}>
                        <span className={'mz-box' + (sel.has(p.id) ? ' on' : '')} aria-hidden="true">
                          {sel.has(p.id) && <Icon name="check" size={16} />}
                        </span>
                        <span className="mz-name">{t(`muscle.${p.id}`)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
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
