import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Піктограма «редагувати» для адміна: веде в редактор розділу чи вправи. Інші її не бачать.
// inline: у рядку панелі (TopBar); інакше накладається в правий верхній кут картки (батько .edit-wrap).
export default function EditFab({ to, inline }) {
  const { isAdmin } = useAuth();
  const { t } = useI18n();
  if (!isAdmin || !to) return null;
  return (
    <Link to={to} className={inline ? 'edit-inline' : 'edit-fab'} aria-label={t('content.edit')}>
      <Icon name="edit" size={inline ? 22 : 18} />
    </Link>
  );
}
