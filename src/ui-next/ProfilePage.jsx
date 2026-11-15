import ProfileCard from '../components/ProfileCard.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';
import ShareLink from '../components/ShareLink.jsx';
import UpdateRow from '../components/UpdateRow.jsx';
import { useI18n } from '../i18n/index.jsx';

// Вкладка «Профіль»: те саме, що було у висувних налаштуваннях, тепер окремою сторінкою.
export default function ProfilePage() {
  const { t } = useI18n();
  return (
    <main className="page">
      <h1 className="title">{t('nav.profile')}</h1>
      <div className="profile-page sheet-body">
        <ProfileCard />
        <div className="set-row">
          <span className="set-label">{t('settings.language')}</span>
          <LangSwitcher />
        </div>
        <ShareLink />
        <UpdateRow />
      </div>
    </main>
  );
}
