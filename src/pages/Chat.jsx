import TopBar from '../components/TopBar.jsx';
import ChatThread from '../components/ChatThread.jsx';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Чат учня з тренером.
export default function Chat() {
  const { t } = useI18n();
  const { user } = useAuth();
  return (
    <main className="page">
      <TopBar title={t('chat.title')} to="/profile" />
      {user ? <ChatThread studentId={user.id} /> : <p className="muted">{t('chat.needLogin')}</p>}
    </main>
  );
}
