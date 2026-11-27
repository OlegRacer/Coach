import ProfileCard from '../components/ProfileCard.jsx';
import { useI18n } from '../i18n/index.jsx';

// Вкладка «Профіль»: те саме, що було у висувних налаштуваннях, тепер окремою сторінкою.
export default function ProfilePage() {
  const { t } = useI18n();
  return (
    <main className="page wide">
      <h1 className="title">{t('nav.profile')}</h1>
      <div className="profile-page sheet-body">
        <ProfileCard tail />
      </div>
    </main>
  );
}
