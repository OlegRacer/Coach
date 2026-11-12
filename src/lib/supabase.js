import { createClient } from '@supabase/supabase-js';

// Ці два значення публічні за задумом Supabase: їх можна тримати в браузерному коді.
// Дані захищені правилами доступу в самій базі (Row Level Security), а не секретністю ключа.
// Ключ service_role / secret сюди НІКОЛИ не вставляти.
const SUPABASE_URL = 'https://qbgeogmupdigvmywgdoi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dudAdZZvVWffIjRtfTqs9Q_F8DdrYPH';

// Адреса, яку Google показує на екрані входу (див. SignInNotice).
export const SUPABASE_HOST = new URL(SUPABASE_URL).host;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
});
