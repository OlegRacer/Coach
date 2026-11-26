import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../auth/index.jsx';
import { useThreads } from '../lib/chat.js';

// Список розмов для тренера: за часом останнього повідомлення, з лічильником непрочитаних.
export default function ChatInbox() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAuth();
  const { rows } = useThreads();
  const locale = lang === 'zh-TW' ? 'zh-TW' : lang === 'en' ? 'en-GB' : 'uk-UA';
  if (!isAdmin) return null;
  return (
    <main className="page">
      <TopBar title={t('chat.inbox')} to="/profile" />
      {!rows && <p className="muted">{t('admin.loading')}</p>}
      {rows && !rows.length && <p className="muted">{t('chat.inboxEmpty')}</p>}
      <div className="stack">
        {(rows || []).map((r) => (
          <Link key={r.student_id} to={`/admin/chat/${r.student_id}`} className="list-item chat-thread-row">
            <span className="list-main">
              <b>
                {r.full_name || r.email}
                {r.muted && <span className="badge-link">{t('chat.muted')}</span>}
              </b>
              <span className="muted small chat-last">{r.last_by_student ? '' : t('chat.you') + ' '}{r.last_body}</span>
              <span className="muted small">{new Date(r.last_at).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </span>
            {r.unread > 0 && <span className="badge-count">{r.unread}</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
