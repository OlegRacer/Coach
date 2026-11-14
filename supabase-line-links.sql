-- Прив'язка LINE до існуючого акаунта (щоб Google і LINE вели в один акаунт). Запусти один раз у SQL Editor.
create table if not exists public.line_links (
  line_sub text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists line_links_user_idx on public.line_links (user_id);
alter table public.line_links enable row level security;
-- Учень бачить лише свою прив'язку; писати може лише Edge Function (service role).
drop policy if exists "line_links read own" on public.line_links;
create policy "line_links read own" on public.line_links for select to authenticated using (user_id = auth.uid());
revoke all on public.line_links from anon;

-- Допоміжна функція для Edge Function: id користувача за поштою (лише service_role)
create or replace function public.auth_user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1
$$;
revoke all on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

notify pgrst, 'reload schema';
