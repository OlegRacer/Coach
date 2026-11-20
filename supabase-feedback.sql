-- Зворотний зв'язок: учні надсилають повідомлення про помилку чи ідею (з фото), тренер бачить їх у «Відгуки».
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібні: supabase-schema.sql (is_admin).
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('bug', 'idea')),
  message    text not null check (char_length(message) between 1 and 4000),
  photo_path text not null default '',
  page       text not null default '',
  user_agent text not null default '',
  status     text not null default 'new' check (status in ('new', 'done')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;
drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated with check (user_id = auth.uid());
drop policy if exists feedback_select on public.feedback;
create policy feedback_select on public.feedback for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists feedback_update on public.feedback;
create policy feedback_update on public.feedback for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists feedback_delete on public.feedback;
create policy feedback_delete on public.feedback for delete to authenticated using (public.is_admin());

-- Фото до відгуків: приватне сховище; учень пише у свою папку <його id>/, тренер читає й видаляє все.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback', 'feedback', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists feedback_files_insert on storage.objects;
create policy feedback_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists feedback_files_select on storage.objects;
create policy feedback_files_select on storage.objects for select to authenticated
  using (bucket_id = 'feedback' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists feedback_files_admin_delete on storage.objects;
create policy feedback_files_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'feedback' and public.is_admin());

notify pgrst, 'reload schema';
