-- Імена в чатах: показуємо ім'я та прізвище з анкети учня (а не ім'я з Google/LINE).
-- Запусти один раз у Supabase → SQL Editor (можна повторно) ПІСЛЯ supabase-chat.sql і supabase-chat-groups.sql.

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

create or replace function public.chat_group_messages_get(p_group uuid, p_limit integer default 300) returns table (
  id uuid, group_id uuid, sender_id uuid, sender_name text, body text, created_at timestamptz, edited_at timestamptz, pinned boolean
) language sql stable security definer set search_path = public as $$
  select * from (
    select m.id, m.group_id, m.sender_id, public.student_display_name(m.sender_id) as sender_name,
           m.body, m.created_at, m.edited_at, m.pinned
    from public.chat_group_messages m left join public.profiles p on p.id = m.sender_id
    where m.group_id = p_group and public.chat_is_member(p_group)
    order by m.created_at desc limit greatest(1, least(p_limit, 500))
  ) t order by t.created_at asc
$$;

create or replace function public.chat_groups_list() returns table (
  id uuid, title text, students_can_write boolean, member_count integer, last_body text, last_at timestamptz, last_name text, unread integer
) language sql stable security definer set search_path = public as $$
  select g.id, g.title, g.students_can_write,
    (select count(*)::int from public.chat_group_members m where m.group_id = g.id),
    l.body, l.created_at, public.student_display_name(l.sender_id),
    (select count(*)::int from public.chat_group_messages x
      where x.group_id = g.id and x.sender_id <> auth.uid()
        and x.created_at > coalesce((select r.last_read_at from public.chat_group_reads r where r.group_id = g.id and r.user_id = auth.uid()), '-infinity'::timestamptz))
  from public.chat_groups g
  left join lateral (select * from public.chat_group_messages x where x.group_id = g.id order by x.created_at desc limit 1) l on true
  left join public.profiles p on p.id = l.sender_id
  where public.chat_is_member(g.id)
  order by coalesce(l.created_at, g.created_at) desc
$$;

create or replace function public.chat_group_members_get(p_group uuid) returns table (student_id uuid, full_name text, email text)
language sql stable security definer set search_path = public as $$
  select m.student_id, public.student_display_name(m.student_id), p.email from public.chat_group_members m join public.profiles p on p.id = m.student_id
  where m.group_id = p_group and coalesce(public.is_admin(), false) order by 2
$$;

