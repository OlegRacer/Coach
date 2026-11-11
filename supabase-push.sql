-- Пуш-сповіщення: підписки пристроїв і автоматичне надсилання при оплаті.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібні: supabase-payments.sql. Після цього розгорніть Edge Function push (див. README, розділ «Пуш-сповіщення»).

create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  lang       text not null default 'uk',
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

drop policy if exists push_own on public.push_subscriptions;
create policy push_own on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.push_subscriptions from anon;

-- Позначки «вже сповістили», щоб одна заявка не давала дублікатів.
alter table public.payment_requests add column if not exists admin_notified_at timestamptz;
alter table public.payment_requests add column if not exists student_notified_at timestamptz;

-- Виклик Edge Function. Помилка мережі ніколи не блокує створення чи підтвердження заявки.
create or replace function public.push_notify() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  kind text;
begin
  if tg_op = 'INSERT' then
    kind := 'new_payment';
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    kind := 'payment_decided';
  else
    return null;
  end if;
  begin
    perform net.http_post(
      url := 'https://qbgeogmupdigvmywgdoi.supabase.co/functions/v1/push',
      body := jsonb_build_object('type', kind, 'id', new.id),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );
  exception when others then
    null;
  end;
  return null;
end $$;

drop trigger if exists payment_requests_push on public.payment_requests;
create trigger payment_requests_push after insert or update of status on public.payment_requests
  for each row execute function public.push_notify();

notify pgrst, 'reload schema';
