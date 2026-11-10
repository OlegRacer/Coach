import groups from '../data/muscles.json';

// Група (груди, руки, плечі…) або проста зона без частин. Частини (біцепс, передня дельта…) це «півзони».
// «Листок» це найдрібніша зона, яку можна підсвітити: півзона, а якщо їх нема, то сама група.
export const GROUPS = groups;

export const LEAVES = groups.flatMap((g) =>
  g.parts ? g.parts.map((p) => ({ id: p.id, group: g.id, regions: p.regions })) : [{ id: g.id, group: g.id, regions: g.regions }]
);

const leafById = Object.fromEntries(LEAVES.map((l) => [l.id, l]));
const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));

// Усі id, які можна вказати у вправі: групи й півзони.
export const ALL_IDS = groups.flatMap((g) => (g.parts ? [g.id, ...g.parts.map((p) => p.id)] : [g.id]));
export const isKnown = (id) => !!leafById[id] || !!groupById[id];

export function leavesOfGroup(gid) {
  return LEAVES.filter((l) => l.group === gid).map((l) => l.id);
}

// ['arms', 'chest'] -> ['biceps', 'triceps', 'forearms', 'chest']
export function expand(ids) {
  const out = new Set();
  (ids || []).forEach((id) => {
    if (leafById[id]) out.add(id);
    else if (groupById[id]) leavesOfGroup(id).forEach((l) => out.add(l));
  });
  return out;
}

// Назва для тексту: для півзон дельти з «повною» назвою (muscle.<id>.full), інакше звичайна.
export function muscleName(t, id) {
  return t(`muscle.${id}.full`, undefined, t(`muscle.${id}`));
}
