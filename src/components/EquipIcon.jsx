// Іконка інвентаря: власна картинка за id довідника, а якщо її немає — емодзі з бази (для інвентаря, доданого тренером).
const files = import.meta.glob('../assets/equip/*.webp', { eager: true, query: '?url', import: 'default' });
const byId = {};
Object.keys(files).forEach((p) => {
  byId[p.split('/').pop().replace('.webp', '')] = files[p];
});

export default function EquipIcon({ item, size = 28 }) {
  const src = item && byId[item.id];
  if (src) return <img className="equip-ic" src={src} alt="" width={size} height={size} draggable={false} />;
  return <span aria-hidden="true">{item ? item.icon : ''}</span>;
}
