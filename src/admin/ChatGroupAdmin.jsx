import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import ChatThread from '../components/ChatThread.jsx';
import { useGroups } from '../lib/chat.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Розмова групи (тренер): повідомлення, закріплення, перехід до налаштувань групи.
export default function ChatGroupAdmin() {
  const { gid } = useParams();
  const { t } = useI18n();
  const { isAdmin } = useAuth();
  const { rows } = useGroups();
  if (!isAdmin) return null;
  const g = (rows || []).find((x) => x.id === gid);
  return (
    <main className="page">
      <TopBar title={(g && g.title) || '…'} to="/admin/chat" action={<Link to={`/admin/chat/g/${gid}/edit`} className="btn-ghost btn-small">{t('chat.groupSettings')}</Link>} />
      <ChatThread groupId={gid} admin />
    </main>
  );
}
