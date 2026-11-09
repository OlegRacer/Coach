-- Доступ учнів до розділів на певну кількість днів.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібна схема з supabase-schema.sql (таблиця profiles і функція is_admin).

create table if not exists public.section_access (
  student_id uuid not null references public.profiles (id) on delete cascade,
  section    text not null check (section in ('fitness', 'mfr', 'mobility', 'anatomy')),
  expires_at timestamptz not null,
  granted_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (student_id, section)
);

alter table public.section_access enable row level security;

-- Учень бачить лише свій доступ. Тренер бачить усе. Міняє доступ тільки тренер.
drop policy if exists access_select on public.section_access;
create policy access_select on public.section_access
  for select to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists access_admin_write on public.section_access;
create policy access_admin_write on public.section_access
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.section_access from anon;

notify pgrst, 'reload schema';
