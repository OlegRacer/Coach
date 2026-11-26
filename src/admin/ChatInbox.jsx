import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../auth/index.jsx';
import { useGroups, useThreads } from '../lib/chat.js';

// Для тренера: групи та особисті розмови за часом останнього повідомлення, з лічильниками непрочитаних.
export default function ChatInbox() {
  const { t, lang } = useI18n();
  const { isAdmin } = useAuth();
  const { rows } = useThreads();
  const groups = useGroups();
  const locale = lang === 'zh-TW' ? 'zh-TW' : lang === 'en' ? 'en-GB' : 'uk-UA';
  if (!isAdmin) return null;
  const fmt = (iso) => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <main className="page">
      <TopBar title={t('chat.inbox')} to="/profile" action={<Link to="/admin/chat/new" className="btn-ghost btn-small">{t('chat.newGroup')}</Link>} />
      {groups.rows && groups.rows.length > 0 && (
        <>
          <span className="muted small chat-section">{t('chat.groups')}</span>
          <div className="stack">
            {groups.rows.map((g) => (
              <Link key={g.id} to={`/admin/chat/g/${g.id}`} className="list-item chat-thread-row">
                <span className="list-main">
                  <b>{g.title}<span className="badge-link">{t('chat.members', { n: g.member_count })}</span></b>
                  {g.last_body && <span className="muted small chat-last">{g.last_name ? g.last_name + ': ' : ''}{g.last_body}</span>}
                </span>
                {g.unread > 0 && <span className="badge-count">{g.unread}</span>}
              </Link>
            ))}
          </div>
          <span className="muted small chat-section">{t('chat.personal')}</span>
        </>
      )}
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
              <span className="muted small">{fmt(r.last_at)}</span>
            </span>
            {r.unread > 0 && <span className="badge-count">{r.unread}</span>}
          </Link>
        ))}
      </div>
    </main>
  );
}
