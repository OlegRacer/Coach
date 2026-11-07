-- =====================================================================
-- Схема бази для додатка тренувань (Supabase).
-- Запуск: Supabase -> SQL Editor -> New query -> вставити все -> Run.
-- Скрипт можна запускати повторно, нічого не зламається.
--
-- ПЕРЕД ЗАПУСКОМ: у блоці "АДМІН" (внизу) впишіть email вашого Google-акаунта.
-- =====================================================================

-- 1. Профілі: один рядок на кожного, хто увійшов у додаток ---------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  avatar_url   text,
  email        text,
  phone        text,                       -- контакт, який ви вписуєте самі
  provider     text,                       -- google / line / email
  role         text not null default 'student' check (role in ('student', 'admin')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz
);

-- 2. Кому дозволено бути адміном (за email, перевіряється при першому вході) -
create table if not exists public.admin_emails (
  email text primary key
);
alter table public.admin_emails enable row level security;  -- без політик: через API недоступна нікому

-- 3. Програми тренувань ---------------------------------------------------
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  content     jsonb not null default '{}'::jsonb,   -- дні, вправи, підходи
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 4. Призначення: яка програма відкрита якому учню ------------------------
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id) on delete cascade,
  program_id  uuid not null references public.programs (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (student_id, program_id)
);

-- 5. Допоміжна функція: чи поточний користувач адмін ----------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 6. Автоматичний профіль при першому вході --------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, email, provider, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url',
             new.raw_user_meta_data ->> 'picture'),
    new.email,
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    case when exists (select 1 from public.admin_emails a
                      where lower(a.email) = lower(coalesce(new.email, '')))
         then 'admin' else 'student' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7. Правила доступу (Row Level Security) ----------------------------------
alter table public.profiles    enable row level security;
alter table public.programs    enable row level security;
alter table public.assignments enable row level security;

-- profiles: учень бачить тільки себе, адмін бачить усіх
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Змінювати можна лише ці поля. Роль (role) клієнт змінити не може ні в кого.
revoke update on public.profiles from authenticated, anon;
grant  update (full_name, phone, last_seen_at) on public.profiles to authenticated;

-- programs: учень бачить лише призначені йому, адмін бачить і міняє все
drop policy if exists programs_select on public.programs;
create policy programs_select on public.programs
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.assignments a
               where a.program_id = programs.id and a.student_id = auth.uid())
  );

drop policy if exists programs_admin_write on public.programs;
create policy programs_admin_write on public.programs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- assignments: учень бачить свої, адмін керує всіма
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments
  for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists assignments_admin_write on public.assignments;
create policy assignments_admin_write on public.assignments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Анонімні відвідувачі (хто не увійшов) не бачать нічого з цих таблиць
revoke all on public.profiles, public.programs, public.assignments, public.admin_emails from anon;

-- 8. Нові реєстрації з'являються у вас в додатку одразу (Realtime) ---------
do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;

-- 9. АДМІН: впишіть свій email (той, яким заходите через Google) ----------
insert into public.admin_emails (email)
values ('ВАШ_EMAIL@gmail.com')
on conflict do nothing;

-- Якщо ви вже входили в додаток до запуску скрипта, зробіть адміном і наявний профіль:
update public.profiles set role = 'admin'
where lower(email) in (select lower(email) from public.admin_emails);
