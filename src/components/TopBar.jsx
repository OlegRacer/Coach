import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function TopBar({ title, to = '/' }) {
  const { t } = useI18n();
  return (
    <header className="topbar">
      <Link to={to} className="back" aria-label={t('common.back')}>
        <Icon name="back" size={22} />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}
