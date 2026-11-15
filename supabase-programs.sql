-- Програми тренувань: позначка розділу + власні програми учнів. Запусти один раз у SQL Editor (можна повторно).
-- Потрібен supabase-my-plan.sql.
alter table public.content_sections add column if not exists is_program boolean not null default false;

create table if not exists public.student_programs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  exercise_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists student_programs_student_idx on public.student_programs (student_id);
alter table public.student_programs enable row level security;
drop policy if exists "sp own" on public.student_programs;
create policy "sp own" on public.student_programs for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists "sp admin read" on public.student_programs;
create policy "sp admin read" on public.student_programs for select to authenticated using (public.is_admin());
revoke all on public.student_programs from anon;

alter table public.student_plan_items drop constraint if exists student_plan_items_kind_check;
alter table public.student_plan_items add constraint student_plan_items_kind_check
  check (kind in ('section', 'exercise', 'package', 'class', 'program'));
notify pgrst, 'reload schema';
