// Кроки гіду. sel: елемент з data-tour (підсвічується), route: куди перейти перед кроком. Без sel картка стоїть по центру.
const T = (id) => `[data-tour="${id}"]`;
const profile = '/profile';

export const STUDENT_STEPS = [
  { id: 'welcome' },
  { id: 'push', route: profile, sel: T('p-push') },
  { id: 'chat', route: profile, sel: T('p-chat') },
  { id: 'theme', route: profile, sel: T('p-theme') },
  { id: 'lang', route: profile, sel: T('p-lang') },
  { id: 'reorder', route: profile, sel: T('p-equip') },
  { id: 'tabWork', sel: T('tab-/') },
  { id: 'tabSchedule', sel: T('tab-/schedule') },
  { id: 'tabPlans', sel: T('tab-/plans') },
  { id: 'howto', route: profile, sel: T('p-howto') }
];

export const ADMIN_STEPS = [
  { id: 'welcomeAdmin' },
  { id: 'push', route: profile, sel: T('p-push') },
  { id: 'apush', route: profile, sel: T('p-apush') },
  { id: 'achat', route: profile, sel: T('p-achat') },
  { id: 'acontent', route: profile, sel: T('p-acontent') },
  { id: 'theme', route: profile, sel: T('p-theme') },
  { id: 'reorder', route: profile, sel: T('p-equip') },
  { id: 'tabWork', sel: T('tab-/') },
  { id: 'tabSchedule', sel: T('tab-/schedule') },
  { id: 'howto', route: profile, sel: T('p-howto') }
];
