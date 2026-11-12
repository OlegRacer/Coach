-- Коментар тренера про учня і прив'язка учня до тренерів. Бачать і міняють лише адміни.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібні: supabase-schema.sql і supabase-schedule.sql (таблиця trainers).

create table if not exists public.student_notes (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  note       text not null default '' check (char_length(note) <= 4000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.student_trainers (
  student_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid not null references public.trainers (id) on delete cascade,
  primary key (student_id, trainer_id)
);

alter table public.student_notes enable row level security;
alter table public.student_trainers enable row level security;

drop policy if exists student_notes_admin on public.student_notes;
create policy student_notes_admin on public.student_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists student_trainers_admin on public.student_trainers;
create policy student_trainers_admin on public.student_trainers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.student_notes, public.student_trainers from anon;

notify pgrst, 'reload schema';
