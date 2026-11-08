-- Анкета учня. Supabase -> SQL Editor -> New query -> вставити все -> Run.
-- Можна запускати повторно. Потрібно, щоб схема з supabase-schema.sql уже була виконана.

create table if not exists public.student_details (
  student_id        uuid primary key references public.profiles (id) on delete cascade,
  first_name        text check (char_length(first_name) <= 80),
  last_name         text check (char_length(last_name) <= 80),
  contact_messenger text check (contact_messenger in ('line', 'telegram', 'whatsapp', 'instagram')),
  contact_handle    text check (char_length(contact_handle) <= 100),
  goals             text[] not null default '{}'
                    check (goals <@ array['lose_weight', 'muscle', 'mobility', 'recovery', 'maintain']::text[]),
  limitations       text check (char_length(limitations) <= 2000),
  consent_at        timestamptz,
  completed_at      timestamptz,
  updated_at        timestamptz not null default now()
);

-- Тіло: для формули калорій. Додається і до вже створеної таблиці.
alter table public.student_details add column if not exists height_cm numeric(5,1);
alter table public.student_details add column if not exists weight_kg numeric(5,1);
alter table public.student_details add column if not exists birth_year smallint;
alter table public.student_details drop constraint if exists student_details_body_check;
alter table public.student_details add constraint student_details_body_check check (
  (height_cm is null or height_cm between 80 and 250)
  and (weight_kg is null or weight_kg between 20 and 400)
  and (birth_year is null or birth_year between 1920 and 2025)
);

alter table public.student_details enable row level security;

-- Бачить сам учень і тренер. Змінює тільки сам учень. Видалити може учень або тренер.
drop policy if exists details_select on public.student_details;
create policy details_select on public.student_details
  for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists details_insert on public.student_details;
create policy details_insert on public.student_details
  for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists details_update on public.student_details;
create policy details_update on public.student_details
  for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists details_delete on public.student_details;
create policy details_delete on public.student_details
  for delete to authenticated
  using (student_id = auth.uid() or public.is_admin());

revoke all on public.student_details from anon;

notify pgrst, 'reload schema';
