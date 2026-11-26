-- Чат учня з тренером (лише текст) + налаштування пуш-сповіщень для адмінів.
-- Запусти один раз у Supabase → SQL Editor (можна повторно). Потрібні supabase-push.sql (pg_net) і supabase-students/profiles.
-- Після запуску перерозгорни Edge Function push (supabase/functions/push/index.ts).
-- Автоочищення: щодня видаляються повідомлення старіші за 90 днів, крім закріплених (потрібен увімкнений pg_cron).

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,   -- чия це розмова
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  read_at timestamptz,
  pinned boolean not null default false,
  notified_at timestamptz
);
create index if not exists chat_messages_thread on public.chat_messages (student_id, created_at desc);
create index if not exists chat_messages_old on public.chat_messages (created_at) where not pinned;

create table if not exists public.chat_mutes (
  student_id uuid primary key references auth.users(id) on delete cascade,
  muted_at timestamptz not null default now()
);

create table if not exists public.admin_push_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb
);

alter table public.chat_messages enable row level security;
alter table public.chat_mutes enable row level security;
alter table public.admin_push_prefs enable row level security;

-- Чи може цей користувач писати в розмову учня
create or replace function public.chat_can_write(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    coalesce(public.is_admin(), false)
    or (p_student = auth.uid() and not exists (select 1 from public.chat_mutes m where m.student_id = p_student))
  )
$$;
grant execute on function public.chat_can_write(uuid) to authenticated;

drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated
  using (student_id = auth.uid() or coalesce(public.is_admin(), false));
drop policy if exists chat_insert on public.chat_messages;
create policy chat_insert on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.chat_can_write(student_id) and not pinned and read_at is null and edited_at is null);
-- змінювати й видаляти можна лише через функції нижче

drop policy if exists mutes_select on public.chat_mutes;
create policy mutes_select on public.chat_mutes for select to authenticated using (student_id = auth.uid() or coalesce(public.is_admin(), false));

drop policy if exists prefs_own on public.admin_push_prefs;
create policy prefs_own on public.admin_push_prefs for all to authenticated
  using (user_id = auth.uid() and coalesce(public.is_admin(), false)) with check (user_id = auth.uid() and coalesce(public.is_admin(), false));

revoke all on public.chat_messages from anon;
revoke update, delete on public.chat_messages from authenticated;
revoke all on public.chat_mutes from anon;
revoke insert, update, delete on public.chat_mutes from authenticated;
revoke all on public.admin_push_prefs from anon;

-- Редагування власного повідомлення (лишається позначка edited_at)
create or replace function public.chat_edit(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.chat_messages set body = btrim(p_body), edited_at = now()
  where id = p_id and sender_id = auth.uid() and public.chat_can_write(student_id) and btrim(p_body) <> body;
end $$;

-- Видалення: своє повідомлення (учень чи тренер) або будь-яке (тренер)
create or replace function public.chat_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chat_messages where id = p_id and (sender_id = auth.uid() or coalesce(public.is_admin(), false));
end $$;

-- Позначити прочитаними чужі повідомлення в розмові
create or replace function public.chat_mark_read(p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (p_student = auth.uid() or coalesce(public.is_admin(), false)) then return; end if;
  update public.chat_messages set read_at = now()
  where student_id = p_student and read_at is null and sender_id <> auth.uid();
end $$;

create or replace function public.chat_pin(p_id uuid, p_pin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  update public.chat_messages set pinned = p_pin where id = p_id;
end $$;

create or replace function public.chat_mute(p_student uuid, p_mute boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  if p_mute then insert into public.chat_mutes (student_id) values (p_student) on conflict do nothing;
  else delete from public.chat_mutes where student_id = p_student; end if;
end $$;

-- Очистити розмову (закріплені лишаються)
create or replace function public.chat_clear(p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  delete from public.chat_messages where student_id = p_student and not pinned;
end $$;

-- Кількість непрочитаних: учню від тренера, тренеру від усіх учнів
create or replace function public.chat_unread() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.chat_messages m
  where m.read_at is null and m.sender_id <> auth.uid()
    and (m.student_id = auth.uid() or coalesce(public.is_admin(), false))
$$;

-- Ім'я учня для чату: спершу ім'я та прізвище з анкети, потім ім'я з Google/LINE, потім пошта.
create or replace function public.student_display_name(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(btrim(concat_ws(' ', d.first_name, d.last_name)), ''),
    nullif(p.full_name, ''),
    split_part(p.email, '@', 1)
  )
  from public.profiles p left join public.student_details d on d.student_id = p.id
  where p.id = p_id
$$;
grant execute on function public.student_display_name(uuid) to authenticated;

-- Список розмов для тренера: останнє повідомлення, непрочитані, мут
create or replace function public.chat_threads() returns table (
  student_id uuid, full_name text, email text, last_body text, last_at timestamptz, last_by_student boolean, unread integer, muted boolean
) language sql stable security definer set search_path = public as $$
  select t.student_id, public.student_display_name(t.student_id), p.email, t.body, t.created_at, (t.sender_id = t.student_id),
    (select count(*)::int from public.chat_messages u where u.student_id = t.student_id and u.read_at is null and u.sender_id = t.student_id),
    exists (select 1 from public.chat_mutes m where m.student_id = t.student_id)
  from (select distinct on (student_id) * from public.chat_messages order by student_id, created_at desc) t
  join public.profiles p on p.id = t.student_id
  where coalesce(public.is_admin(), false)
  order by t.created_at desc
$$;

grant execute on function public.chat_edit(uuid, text), public.chat_delete(uuid), public.chat_mark_read(uuid), public.chat_pin(uuid, boolean),
  public.chat_mute(uuid, boolean), public.chat_clear(uuid), public.chat_unread(), public.chat_threads() to authenticated;

-- Пуш про нове повідомлення (помилка мережі ніколи не блокує запис)
create or replace function public.chat_notify() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url := 'https://qbgeogmupdigvmywgdoi.supabase.co/functions/v1/push',
      body := jsonb_build_object('type', 'chat_message', 'id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  exception when others then
    null;
  end;
  return null;
end $$;
drop trigger if exists chat_messages_push on public.chat_messages;
create trigger chat_messages_push after insert on public.chat_messages for each row execute function public.chat_notify();

-- Реальний час: нові повідомлення приходять без оновлення сторінки
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- Автоочищення: щодня о 03:30 за Тайбеєм видаляємо повідомлення старіші за 90 днів, крім закріплених
do $$ begin
  perform cron.unschedule('chat-cleanup');
exception when others then null; end $$;
do $$ begin
  perform cron.schedule('chat-cleanup', '30 19 * * *', $c$ delete from public.chat_messages where created_at < now() - interval '90 days' and not pinned $c$);
exception when others then raise notice 'pg_cron не ввімкнено: автоочищення не заплановано (Database → Extensions → pg_cron)';
end $$;
