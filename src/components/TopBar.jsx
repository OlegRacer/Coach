import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';

export default function TopBar({ title, to = '/' }) {
  return (
    <header className="topbar">
      <Link to={to} className="back" aria-label="Назад">
        <Icon name="back" size={22} />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}
