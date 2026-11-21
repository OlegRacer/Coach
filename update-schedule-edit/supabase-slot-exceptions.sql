-- Редагування розкладу: скасувати/перенести одне заняття серії та призупинити клас.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібен supabase-schedule.sql.

-- Пауза всієї серії на період (включно з обома датами)
alter table public.schedule_slots add column if not exists pause_from date;
alter table public.schedule_slots add column if not exists pause_to   date;

-- Виняток для однієї дати: cancel (не буде) або move (перенесено на іншу дату/час)
create table if not exists public.slot_exceptions (
  id        uuid primary key default gen_random_uuid(),
  slot_id   uuid not null references public.schedule_slots (id) on delete cascade,
  orig_date date not null,
  kind      text not null check (kind in ('cancel', 'move')),
  new_date  date,
  new_time  time,
  created_at timestamptz not null default now(),
  unique (slot_id, orig_date),
  check (kind = 'cancel' or new_date is not null)
);

alter table public.slot_exceptions enable row level security;

drop policy if exists slot_exceptions_read on public.slot_exceptions;
create policy slot_exceptions_read on public.slot_exceptions for select to anon, authenticated using (true);
drop policy if exists slot_exceptions_write on public.slot_exceptions;
create policy slot_exceptions_write on public.slot_exceptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.slot_exceptions to anon, authenticated;

notify pgrst, 'reload schema';
