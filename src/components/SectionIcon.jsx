import Icon from './Icon.jsx';
import { useUi } from '../lib/ui.jsx';

// Набір іконок розділів (картинки з assets/sec). Старі назви іконок (barbell, roller…) відповідають новим, тож база не змінюється.
const files = import.meta.glob('../assets/sec/*.webp', { eager: true, query: '?url', import: 'default' });
const lightFiles = import.meta.glob('../assets/sec-light/*.webp', { eager: true, query: '?url', import: 'default' });
const lightByName = {};
Object.keys(lightFiles).forEach((p) => {
  lightByName[p.split('/').pop().replace('.webp', '')] = lightFiles[p];
});
const byName = {};
Object.keys(files).forEach((p) => {
  byName[p.split('/').pop().replace('.webp', '')] = files[p];
});

export const SECTION_ICONS = ['stretch', 'stretch-m', 'lunge', 'lunge-m', 'core', 'core-m', 'kettlebell', 'kettlebell-m', 'roller', 'roller-m', 'reach', 'coach-m', 'clipboard', 'plan', 'duo', 'program', 'waist', 'scale'];
const LEGACY = { barbell: 'lunge', roller: 'roller', mobility: 'stretch', anatomy: 'waist', heart: 'coach-m', coach: 'coach-m', target: 'program', chat: 'clipboard' };
export const iconKey = (name) => (byName[name] ? name : LEGACY[name] || '');
export const iconUrl = (name, light = false) => (light && lightByName[iconKey(name)]) || byName[iconKey(name)] || '';

// Плитка-іконка розділу: картинка з набору, а для невідомої назви — стара лінійна іконка на кольоровому тлі.
export default function SectionTile({ section, size = 32, className = '' }) {
  const { light } = useUi();
  const url = iconUrl(section.icon, light);
  if (url) {
    return (
      <span className={'tile-icon has-img ' + className}>
        <img src={url} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className={'tile-icon ' + className} style={{ background: section.color }}>
      <Icon name={section.icon} size={size} />
    </span>
  );
}
