-- Груповий чат: тренер створює групу й додає учнів за студією, класом або вручну. Лише текст.
-- Запусти один раз у Supabase → SQL Editor (можна повторно) ПІСЛЯ supabase-chat.sql.
-- Потім перерозгорни Edge Function push (supabase/functions/push/index.ts).
-- Автоочищення: щодня видаляються повідомлення груп старіші за 90 днів, крім закріплених (потрібен pg_cron).

create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  students_can_write boolean not null default true,   -- false: пише лише тренер
  created_at timestamptz not null default now()
);
create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  primary key (group_id, student_id)
);
create index if not exists chat_group_members_student on public.chat_group_members (student_id);

create table if not exists public.chat_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  pinned boolean not null default false,
  notified_at timestamptz
);
create index if not exists chat_group_messages_thread on public.chat_group_messages (group_id, created_at desc);

-- коли кожен учасник востаннє відкривав групу (для лічильника непрочитаних)
create table if not exists public.chat_group_reads (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_group_messages enable row level security;
alter table public.chat_group_reads enable row level security;

create or replace function public.chat_is_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    coalesce(public.is_admin(), false)
    or exists (select 1 from public.chat_group_members m where m.group_id = p_group and m.student_id = auth.uid())
  )
$$;
create or replace function public.chat_group_can_write(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    coalesce(public.is_admin(), false)
    or (
      exists (select 1 from public.chat_group_members m where m.group_id = p_group and m.student_id = auth.uid())
      and exists (select 1 from public.chat_groups g where g.id = p_group and g.students_can_write)
      and not exists (select 1 from public.chat_mutes x where x.student_id = auth.uid())
    )
  )
$$;
grant execute on function public.chat_is_member(uuid), public.chat_group_can_write(uuid) to authenticated;

drop policy if exists cg_select on public.chat_groups;
create policy cg_select on public.chat_groups for select to authenticated using (public.chat_is_member(id));
drop policy if exists cgm_select on public.chat_group_members;
create policy cgm_select on public.chat_group_members for select to authenticated using (student_id = auth.uid() or coalesce(public.is_admin(), false));
drop policy if exists cgmsg_select on public.chat_group_messages;
create policy cgmsg_select on public.chat_group_messages for select to authenticated using (public.chat_is_member(group_id));
drop policy if exists cgmsg_insert on public.chat_group_messages;
create policy cgmsg_insert on public.chat_group_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.chat_group_can_write(group_id) and not pinned and edited_at is null);
drop policy if exists cgr_own on public.chat_group_reads;
create policy cgr_own on public.chat_group_reads for select to authenticated using (user_id = auth.uid());

revoke all on public.chat_groups, public.chat_group_members, public.chat_group_messages, public.chat_group_reads from anon;
revoke insert, update, delete on public.chat_groups, public.chat_group_members, public.chat_group_reads from authenticated;
revoke update, delete on public.chat_group_messages from authenticated;

-- Керування групами (лише тренер)
create or replace function public.chat_group_create(p_title text, p_students uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'forbidden'; end if;
  insert into public.chat_groups (title) values (btrim(p_title)) returning id into gid;
  insert into public.chat_group_members (group_id, student_id)
    select gid, x from unnest(coalesce(p_students, '{}')) x where exists (select 1 from auth.users u where u.id = x) on conflict do nothing;
  return gid;
end $$;
create or replace function public.chat_group_add(p_group uuid, p_students uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  insert into public.chat_group_members (group_id, student_id)
    select p_group, x from unnest(coalesce(p_students, '{}')) x where exists (select 1 from auth.users u where u.id = x) on conflict do nothing;
end $$;
create or replace function public.chat_group_remove(p_group uuid, p_student uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  delete from public.chat_group_members where group_id = p_group and student_id = p_student;
end $$;
create or replace function public.chat_group_update(p_id uuid, p_title text, p_write boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  update public.chat_groups set title = btrim(p_title), students_can_write = p_write where id = p_id;
end $$;
create or replace function public.chat_group_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  delete from public.chat_groups where id = p_id;
end $$;

-- Дії над повідомленнями групи
create or replace function public.chat_group_edit(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.chat_group_messages set body = btrim(p_body), edited_at = now()
  where id = p_id and sender_id = auth.uid() and public.chat_group_can_write(group_id) and btrim(p_body) <> body;
end $$;
create or replace function public.chat_group_msg_delete(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.chat_group_messages where id = p_id and (sender_id = auth.uid() or coalesce(public.is_admin(), false));
end $$;
create or replace function public.chat_group_pin(p_id uuid, p_pin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  update public.chat_group_messages set pinned = p_pin where id = p_id;
end $$;
create or replace function public.chat_group_clear(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then return; end if;
  delete from public.chat_group_messages where group_id = p_group and not pinned;
end $$;
create or replace function public.chat_group_mark_read(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.chat_is_member(p_group) then return; end if;
  insert into public.chat_group_reads (group_id, user_id, last_read_at) values (p_group, auth.uid(), now())
  on conflict (group_id, user_id) do update set last_read_at = now();
end $$;

-- Повідомлення групи з іменами відправників (учні не можуть читати чужі профілі напряму)
create or replace function public.chat_group_messages_get(p_group uuid, p_limit integer default 300) returns table (
  id uuid, group_id uuid, sender_id uuid, sender_name text, body text, created_at timestamptz, edited_at timestamptz, pinned boolean
) language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, m.group_id, m.sender_id, coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) as sender_name,
           m.body, m.created_at, m.edited_at, m.pinned
    from public.chat_group_messages m left join public.profiles p on p.id = m.sender_id
    where m.group_id = p_group and public.chat_is_member(p_group)
    order by m.created_at desc limit greatest(1, least(p_limit, 500))
  ) t order by t.created_at asc
$$;

-- Групи поточного користувача (тренер бачить усі): останнє повідомлення, учасники, непрочитані
create or replace function public.chat_groups_list() returns table (
  id uuid, title text, students_can_write boolean, member_count integer, last_body text, last_at timestamptz, last_name text, unread integer
) language sql stable security definer set search_path = public as $$
  select g.id, g.title, g.students_can_write,
    (select count(*)::int from public.chat_group_members m where m.group_id = g.id),
    l.body, l.created_at, coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)),
    (select count(*)::int from public.chat_group_messages x
      where x.group_id = g.id and x.sender_id <> auth.uid()
        and x.created_at > coalesce((select r.last_read_at from public.chat_group_reads r where r.group_id = g.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
  from public.chat_groups g
  left join lateral (select * from public.chat_group_messages x where x.group_id = g.id order by x.created_at desc limit 1) l on true
  left join public.profiles p on p.id = l.sender_id
  where public.chat_is_member(g.id)
  order by coalesce(l.created_at, g.created_at) desc
$$;

-- Учасники групи (для тренера)
create or replace function public.chat_group_members_get(p_group uuid) returns table (student_id uuid, full_name text, email text)
language sql stable security definer set search_path = public as $$
  select m.student_id, p.full_name, p.email from public.chat_group_members m join public.profiles p on p.id = m.student_id
  where m.group_id = p_group and coalesce(public.is_admin(), false) order by p.full_name nulls last
$$;

-- Лічильник непрочитаних тепер враховує і групи
create or replace function public.chat_unread() returns integer
language sql stable security definer set search_path = public as $$
  select (
    (select count(*) from public.chat_messages m
      where m.read_at is null and m.sender_id <> auth.uid()
        and (m.student_id = auth.uid() or coalesce(public.is_admin(), false)))
    +
    (select count(*) from public.chat_group_messages x
      where public.chat_is_member(x.group_id) and x.sender_id <> auth.uid()
        and x.created_at > coalesce((select r.last_read_at from public.chat_group_reads r where r.group_id = x.group_id and r.user_id = auth.uid()), '-infinity'::timestamptz))
  )::int
$$;

grant execute on function public.chat_group_create(text, uuid[]), public.chat_group_add(uuid, uuid[]), public.chat_group_remove(uuid, uuid),
  public.chat_group_update(uuid, text, boolean), public.chat_group_delete(uuid), public.chat_group_edit(uuid, text),
  public.chat_group_msg_delete(uuid), public.chat_group_pin(uuid, boolean), public.chat_group_clear(uuid), public.chat_group_mark_read(uuid),
  public.chat_group_messages_get(uuid, integer), public.chat_groups_list(), public.chat_group_members_get(uuid), public.chat_unread() to authenticated;

-- Пуш про нове повідомлення групи
create or replace function public.chat_group_notify() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url := 'https://qbgeogmupdigvmywgdoi.supabase.co/functions/v1/push',
      body := jsonb_build_object('type', 'chat_group_message', 'id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  exception when others then
    null;
  end;
  return null;
end $$;
drop trigger if exists chat_group_messages_push on public.chat_group_messages;
create trigger chat_group_messages_push after insert on public.chat_group_messages for each row execute function public.chat_group_notify();

do $$ begin
  alter publication supabase_realtime add table public.chat_group_messages;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  perform cron.unschedule('chat-group-cleanup');
exception when others then null; end $$;
do $$ begin
  perform cron.schedule('chat-group-cleanup', '35 19 * * *', $c$ delete from public.chat_group_messages where created_at < now() - interval '90 days' and not pinned $c$);
exception when others then raise notice 'pg_cron не ввімкнено: автоочищення груп не заплановано';
end $$;
