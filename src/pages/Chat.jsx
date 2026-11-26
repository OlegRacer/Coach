import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import ChatThread from '../components/ChatThread.jsx';
import Icon from '../components/Icon.jsx';
import { supabase } from '../lib/supabase.js';
import { useGroups } from '../lib/chat.js';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';

// Чат учня: якщо є групи, спершу список (тренер + групи); якщо ні, одразу розмова з тренером.
export default function Chat({ personal = false }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { rows } = useGroups();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return undefined;
    const load = () => supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('student_id', user.id).is('read_at', null).neq('sender_id', user.id).then(({ count }) => setUnread(count || 0));
    load();
    window.addEventListener('chat:read', load);
    return () => window.removeEventListener('chat:read', load);
  }, [user]);

  if (!user) return <main className="page"><TopBar title={t('chat.title')} to="/profile" /><p className="muted">{t('chat.needLogin')}</p></main>;
  if (!rows) return <main className="page"><TopBar title={t('chat.title')} to="/profile" /></main>;
  if (personal || !rows.length) {
    return (
      <main className="page">
        <TopBar title={t('chat.title')} to={rows.length ? '/chat' : '/profile'} />
        <ChatThread studentId={user.id} />
      </main>
    );
  }
  return (
    <main className="page">
      <TopBar title={t('chat.chats')} to="/profile" />
      <div className="stack">
        <Link to="/chat/me" className="list-item chat-thread-row">
          <span className="list-main"><b>{t('chat.title')}</b></span>
          {unread > 0 && <span className="badge-count">{unread}</span>}
          <span className="muted"><Icon name="chevron" size={20} /></span>
        </Link>
        {rows.map((g) => (
          <Link key={g.id} to={`/chat/g/${g.id}`} className="list-item chat-thread-row">
            <span className="list-main">
              <b>{g.title}</b>
              {g.last_body && <span className="muted small chat-last">{g.last_name ? g.last_name + ': ' : ''}{g.last_body}</span>}
            </span>
            {g.unread > 0 && <span className="badge-count">{g.unread}</span>}
            <span className="muted"><Icon name="chevron" size={20} /></span>
          </Link>
        ))}
      </div>
    </main>
  );
}

// Розмова групи (учень)
export function ChatGroupPage() {
  const { gid } = useParams();
  const { rows } = useGroups();
  const g = (rows || []).find((x) => x.id === gid);
  return (
    <main className="page">
      <TopBar title={(g && g.title) || '…'} to="/chat" />
      <ChatThread groupId={gid} />
    </main>
  );
}
