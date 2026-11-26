import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TopBar from '../components/TopBar.jsx';
import ChatThread from '../components/ChatThread.jsx';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/index.jsx';

// Розмова тренера з окремим учнем.
export default function ChatAdminThread() {
  const { sid } = useParams();
  const { isAdmin } = useAuth();
  const [name, setName] = useState('');
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('profiles').select('full_name, email').eq('id', sid).maybeSingle().then(({ data }) => setName((data && (data.full_name || data.email)) || ''));
  }, [sid, isAdmin]);
  if (!isAdmin) return null;
  return (
    <main className="page">
      <TopBar title={name || '…'} to="/admin/chat" />
      <ChatThread studentId={sid} admin />
    </main>
  );
}
