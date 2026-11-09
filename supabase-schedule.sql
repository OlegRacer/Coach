-- Динамічний розклад: тренери, заняття, запис учнів на заняття.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібна схема з supabase-schema.sql (таблиця profiles і функція is_admin).

create table if not exists public.trainers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 80),
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

-- Заняття: або щотижня в певний день тижня (weekday 1=Пн…7=Нд), або одноразово на дату (on_date).
create table if not exists public.schedule_slots (
  id           uuid primary key default gen_random_uuid(),
  trainer_id   uuid not null references public.trainers (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 120),
  place        text check (char_length(place) <= 120),
  weekday      smallint check (weekday between 1 and 7),
  on_date      date,
  start_time   time not null,
  duration_min int  not null default 60 check (duration_min between 5 and 600),
  created_at   timestamptz not null default now(),
  check ((weekday is not null) <> (on_date is not null))
);

-- Хто з учнів ходить на яке заняття (з цього складається «Мій розклад»)
create table if not exists public.slot_students (
  slot_id    uuid not null references public.schedule_slots (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  primary key (slot_id, student_id)
);

alter table public.trainers       enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.slot_students  enable row level security;

-- Тренери й розклад не секретні: їх бачить будь-хто (навіть без входу). Міняє лише адмін.
drop policy if exists trainers_read on public.trainers;
create policy trainers_read on public.trainers for select to anon, authenticated using (true);
drop policy if exists trainers_write on public.trainers;
create policy trainers_write on public.trainers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists slots_read on public.schedule_slots;
create policy slots_read on public.schedule_slots for select to anon, authenticated using (true);
drop policy if exists slots_write on public.schedule_slots;
create policy slots_write on public.schedule_slots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Запис учнів: учень бачить лише свої рядки, адмін бачить і міняє все.
drop policy if exists slot_students_read on public.slot_students;
create policy slot_students_read on public.slot_students for select to authenticated
  using (student_id = auth.uid() or public.is_admin());
drop policy if exists slot_students_write on public.slot_students;
create policy slot_students_write on public.slot_students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.trainers, public.schedule_slots to anon, authenticated;
revoke all on public.slot_students from anon;

notify pgrst, 'reload schema';
