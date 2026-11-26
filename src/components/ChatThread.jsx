import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/index.jsx';
import { useI18n } from '../i18n/index.jsx';
import { useGroupThread, useThread } from '../lib/chat.js';

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Розмова: бульбашки, поле вводу, редагування/видалення своїх, для тренера ще закріплення й мут.
export default function ChatThread({ studentId, groupId, admin = false }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const personal = useThread(groupId ? null : studentId);
  const grp = useGroupThread(groupId || null);
  const th = groupId ? grp : personal;
  const isGroup = !!groupId;
  const [text, setText] = useState('');
  const [editId, setEditId] = useState(null);
  const [open, setOpen] = useState(null); // id повідомлення з відкритим меню
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const listRef = useRef(null);
  const stick = useRef(true);

  const locale = lang === 'zh-TW' ? 'zh-TW' : lang === 'en' ? 'en-GB' : 'uk-UA';
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (d) => {
    const n = new Date();
    if (dayKey(d) === dayKey(n)) return t('chat.today');
    const y = new Date(n.getTime() - 86400000);
    if (dayKey(d) === dayKey(y)) return t('chat.yesterday');
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
  };

  // Прокрутка вниз при нових повідомленнях, якщо користувач і так унизу
  useLayoutEffect(() => {
    if (stick.current && endRef.current) endRef.current.scrollIntoView({ block: 'end' });
  }, [th.messages.length, th.loading]);
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stick.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
  };
  useEffect(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const canWrite = !th.muted || admin;
  const submit = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    const ok = editId ? await th.edit(editId, v) : await th.send(v);
    setBusy(false);
    if (ok) {
      setText('');
      setEditId(null);
      stick.current = true;
    }
  };
  const startEdit = (m) => {
    setEditId(m.id);
    setText(m.body);
    setOpen(null);
  };

  let lastDay = '';
  return (
    <div className="chat">
      <p className="muted small chat-note">{t('chat.retention')}</p>
      {th.loading && <p className="muted small">{t('admin.loading')}</p>}
      {!th.loading && !th.messages.length && <p className="muted chat-empty">{admin ? t('chat.emptyAdmin') : t('chat.empty')}</p>}
      <div className="chat-list" ref={listRef}>
        {th.messages.map((m) => {
          const d = new Date(m.created_at);
          const k = dayKey(d);
          const head = k !== lastDay ? <div className="chat-day">{fmtDay(d)}</div> : null;
          lastDay = k;
          const mine = m.sender_id === user.id;
          const canEdit = mine && (!th.muted || admin);
          return (
            <div key={m.id}>
              {head}
              <div className={'chat-row' + (mine ? ' mine' : '')}>
                <button type="button" className={'bubble' + (mine ? ' mine' : '') + (m.pinned ? ' pinned' : '')} onClick={() => setOpen(open === m.id ? null : m.id)}>
                  {m.pinned && <span className="pin-tag">{t('chat.pinned')}</span>}
                  {isGroup && !mine && <span className="sender-tag">{m.sender_name}</span>}
                  <span className="bubble-text">{m.body}</span>
                  <span className="bubble-meta">
                    {m.edited_at && <i>{t('chat.edited')}</i>}
                    <i>{fmtTime(m.created_at)}</i>
                    {mine && !isGroup && <i className={m.read_at ? 'rd' : ''}>{m.read_at ? t('chat.read') : t('chat.sent')}</i>}
                  </span>
                </button>
                {open === m.id && (
                  <div className="bubble-menu">
                    {canEdit && <button type="button" onClick={() => startEdit(m)}>{t('chat.edit')}</button>}
                    {(mine || admin) && (
                      <button type="button" onClick={async () => { setOpen(null); if (window.confirm(t('chat.deleteConfirm'))) await th.remove(m.id); }}>{t('chat.delete')}</button>
                    )}
                    {admin && <button type="button" onClick={async () => { setOpen(null); await th.pin(m.id, !m.pinned); }}>{m.pinned ? t('chat.unpin') : t('chat.pin')}</button>}
                    <button type="button" onClick={() => setOpen(null)}>{t('common.close')}</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {th.error && <p className="small bc-err">{th.error}</p>}
      {admin && (
        <div className="chat-admin-bar">
          {!isGroup && <button type="button" className="btn-ghost btn-small" onClick={() => th.setMute(!th.muted)}>{th.muted ? t('chat.unmute') : t('chat.mute')}</button>}
          <button type="button" className="btn-ghost btn-small" onClick={async () => { if (window.confirm(t('chat.clearConfirm'))) await th.clear(); }}>{t('chat.clear')}</button>
        </div>
      )}
      {th.muted && <p className="muted small chat-note">{isGroup ? (admin ? t('chat.groupReadonlyAdmin') : t('chat.groupReadonly')) : admin ? t('chat.mutedAdmin') : t('chat.mutedStudent')}</p>}
      {canWrite && (
        <div className="chat-compose">
          {editId && (
            <div className="chat-editing small muted">
              {t('chat.editing')}
              <button type="button" onClick={() => { setEditId(null); setText(''); }}>{t('common.cancel')}</button>
            </div>
          )}
          <div className="chat-input">
            <textarea
              className="field"
              rows={1}
              maxLength={1000}
              value={text}
              placeholder={t('chat.placeholder')}
              onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px'; }}
            />
            <button type="button" className="btn-primary chat-send" disabled={!text.trim() || busy} onClick={submit}>
              {editId ? t('chat.save') : t('chat.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
