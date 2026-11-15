import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useI18n } from '../i18n/index.jsx';

// «Назад» повертає на попередню сторінку з історії (куди учень реально заходив).
// Якщо історії немає (відкрили за прямим посиланням), веде на `to`.
export default function TopBar({ title, to = '/' }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const onBack = (e) => {
    const idx = window.history.state && window.history.state.idx;
    if (typeof idx === 'number' && idx > 0) {
      e.preventDefault();
      nav(-1);
    }
  };
  return (
    <header className="topbar">
      <Link to={to} onClick={onBack} className="back" aria-label={t('common.back')}>
        <Icon name="back" size={22} />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}
