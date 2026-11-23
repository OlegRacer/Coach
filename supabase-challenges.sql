-- Челенджі: серії занять з датами. Безкоштовні («Приєднатись») і платні («Купити», оплата підтверджується вручну).
-- Заняття автоматично з'являються в «Моєму розкладі» учня. Учень відмічає виконане, тренер бачить учасників і прогрес.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Запускати ПІСЛЯ supabase-packages.sql і supabase-push.sql. Замінює approve_payment().
-- УВАГА: якщо потім знову запустите supabase-packages.sql, запустіть цей файл ще раз.

create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  title       jsonb not null default '{}'::jsonb,        -- {"uk","en","zh-TW"}
  description jsonb not null default '{}'::jsonb,
  mode        text not null default 'fixed' check (mode in ('fixed', 'flex')),  -- fixed: старт задає тренер; flex: старт обирає учень
  start_date  date,                                      -- для fixed
  price       numeric(10,2) not null default 0 check (price >= 0),             -- 0 = безкоштовний
  currency    text not null default 'TWD',
  active      boolean not null default false,            -- false = чернетка
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.challenge_items (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  day_no       int not null check (day_no between 1 and 366),   -- 1 = день старту
  start_time   time not null default '00:00',                   -- 00:00 = у будь-який час
  duration_min int not null default 30 check (duration_min between 5 and 600),
  title        jsonb not null default '{}'::jsonb,
  ref_kind     text check (ref_kind in ('section', 'exercise')),
  ref_id       text,
  position     int not null default 0
);
alter table public.challenge_items add column if not exists refs jsonb not null default '[]'::jsonb;  -- [{kind:'section'|'exercise', id}], кілька посилань на заняття
create index if not exists challenge_items_idx on public.challenge_items (challenge_id, day_no);

create table if not exists public.challenge_members (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  student_id   uuid not null references public.profiles (id) on delete cascade,
  start_date   date not null,
  status       text not null default 'active' check (status in ('active', 'left')),
  paid         boolean not null default false,
  joined_at    timestamptz not null default now(),
  unique (challenge_id, student_id)
);
create index if not exists challenge_members_student_idx on public.challenge_members (student_id);

create table if not exists public.challenge_done (
  student_id uuid not null references public.profiles (id) on delete cascade,
  item_id    uuid not null references public.challenge_items (id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (student_id, item_id)
);

-- Нагадування: щоб одне заняття не сповіщало двічі.
create table if not exists public.challenge_notified (
  student_id  uuid not null references public.profiles (id) on delete cascade,
  item_id     uuid not null references public.challenge_items (id) on delete cascade,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  primary key (student_id, item_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_items enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_done enable row level security;
alter table public.challenge_notified enable row level security;

drop policy if exists chal_select on public.challenges;
create policy chal_select on public.challenges for select to authenticated using (active or public.is_admin());
drop policy if exists chal_admin on public.challenges;
create policy chal_admin on public.challenges for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists chal_items_select on public.challenge_items;
create policy chal_items_select on public.challenge_items for select to authenticated
  using (public.is_admin() or exists (select 1 from public.challenges c where c.id = challenge_id and c.active));
drop policy if exists chal_items_admin on public.challenge_items;
create policy chal_items_admin on public.challenge_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Учасники: учень бачить лише себе; записують тільки функції нижче.
drop policy if exists chal_members_own on public.challenge_members;
create policy chal_members_own on public.challenge_members for select to authenticated using (student_id = auth.uid() or public.is_admin());
drop policy if exists chal_members_admin on public.challenge_members;
create policy chal_members_admin on public.challenge_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Відмітки «виконано»: учень керує своїми, і лише в челенджі, де він активний учасник.
drop policy if exists chal_done_select on public.challenge_done;
create policy chal_done_select on public.challenge_done for select to authenticated using (student_id = auth.uid() or public.is_admin());
drop policy if exists chal_done_insert on public.challenge_done;
create policy chal_done_insert on public.challenge_done for insert to authenticated
  with check (
    student_id = auth.uid() and exists (
      select 1 from public.challenge_items i
      join public.challenge_members m on m.challenge_id = i.challenge_id
      where i.id = item_id and m.student_id = auth.uid() and m.status = 'active'
    )
  );
drop policy if exists chal_done_delete on public.challenge_done;
create policy chal_done_delete on public.challenge_done for delete to authenticated using (student_id = auth.uid());

revoke all on public.challenges, public.challenge_items, public.challenge_members, public.challenge_done, public.challenge_notified from anon;
revoke all on public.challenge_notified from authenticated;

-- Приєднатись: безкоштовний одразу; платний лише якщо вже оплачений раніше (повторне додавання після виходу).
create or replace function public.join_challenge(p_challenge uuid, p_start date default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.challenges;
  m public.challenge_members;
  st date;
begin
  if auth.uid() is null then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.challenges where id = p_challenge and active;
  if not found then raise exception 'not_found'; end if;
  select * into m from public.challenge_members where challenge_id = p_challenge and student_id = auth.uid();
  if c.price > 0 and not (found and m.paid) then raise exception 'payment_required'; end if;
  st := case when c.mode = 'fixed' then c.start_date else coalesce(p_start, m.start_date, current_date) end;
  if st is null then st := current_date; end if;
  insert into public.challenge_members (challenge_id, student_id, start_date, status, paid)
  values (p_challenge, auth.uid(), st, 'active', c.price > 0)
  on conflict (challenge_id, student_id) do update set status = 'active', start_date = excluded.start_date;
end $$;

-- Учень сам переносить старт гнучкого челенджу (відмітки виконаного зберігаються).
create or replace function public.change_challenge_start(p_challenge uuid, p_start date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_start is null then raise exception 'bad_date'; end if;
  update public.challenge_members m set start_date = p_start
  where m.challenge_id = p_challenge and m.student_id = auth.uid() and m.status = 'active'
    and exists (select 1 from public.challenges c where c.id = p_challenge and c.mode = 'flex');
  if not found then raise exception 'not_allowed'; end if;
end $$;

create or replace function public.leave_challenge(p_challenge uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.challenge_members set status = 'left' where challenge_id = p_challenge and student_id = auth.uid();
end $$;

-- Тренер додає учня вручну (без оплати або після оплати поза додатком).
create or replace function public.admin_add_member(p_challenge uuid, p_student uuid, p_start date default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  c public.challenges;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from public.challenges where id = p_challenge;
  if not found then raise exception 'not_found'; end if;
  insert into public.challenge_members (challenge_id, student_id, start_date, status, paid)
  values (p_challenge, p_student, coalesce(case when c.mode = 'fixed' then c.start_date else p_start end, c.start_date, current_date), 'active', c.price > 0)
  on conflict (challenge_id, student_id) do update set status = 'active', paid = public.challenge_members.paid or c.price > 0;
end $$;

-- Підтвердження оплати: для челенджу приєднує учня, для пакета видає доступ (як раніше).
create or replace function public.approve_payment(request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.payment_requests;
  c public.challenges;
  exp timestamptz;
  cid uuid;
  st date;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.payment_requests where id = request_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  if r.plan ? 'challenge_id' then
    cid := (r.plan ->> 'challenge_id')::uuid;
    select * into c from public.challenges where id = cid;
    if not found then raise exception 'not_found'; end if;
    st := coalesce(case when c.mode = 'fixed' then c.start_date else nullif(r.plan ->> 'start_date', '')::date end, c.start_date, current_date);
    insert into public.challenge_members (challenge_id, student_id, start_date, status, paid)
    values (cid, r.student_id, st, 'active', true)
    on conflict (challenge_id, student_id) do update set status = 'active', paid = true, start_date = excluded.start_date;
  else
    exp := public.grant_plan_access(r.student_id, r.plan);
    insert into public.student_packages (student_id, plan_id, plan, source, payment_id, expires_at, granted_by)
    values (r.student_id, r.plan_id, r.plan, 'payment', r.id, exp, auth.uid())
    on conflict (payment_id) do nothing;
  end if;
  update public.payment_requests
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = request_id;
end $$;

revoke all on function public.join_challenge(uuid, date), public.change_challenge_start(uuid, date), public.leave_challenge(uuid), public.admin_add_member(uuid, uuid, date), public.approve_payment(uuid) from public, anon;
grant execute on function public.join_challenge(uuid, date), public.change_challenge_start(uuid, date), public.leave_challenge(uuid), public.admin_add_member(uuid, uuid, date), public.approve_payment(uuid) to authenticated;

-- Нагадування про заняття челенджу: за годину до початку; для занять «у будь-який час» о 08:00. Час тайванський.
-- Запускається кожні 15 хвилин (pg_cron) і викликає Edge Function push.
create or replace function public.challenge_reminders() returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  rec record;
  tz constant text := 'Asia/Taipei';
begin
  for rec in
    select m.student_id, i.id as item_id
    from public.challenge_members m
    join public.challenges c on c.id = m.challenge_id and c.active
    join public.challenge_items i on i.challenge_id = m.challenge_id
    cross join lateral (
      select ((m.start_date + (i.day_no - 1))::timestamp
              + case when i.start_time = time '00:00' then interval '8 hours' else i.start_time::interval - interval '1 hour' end) at time zone tz as due
    ) d
    where m.status = 'active'
      and now() >= d.due and now() < d.due + interval '3 hours'
      and not exists (select 1 from public.challenge_done x where x.student_id = m.student_id and x.item_id = i.id)
      and not exists (select 1 from public.challenge_notified n where n.student_id = m.student_id and n.item_id = i.id)
  loop
    insert into public.challenge_notified (student_id, item_id) values (rec.student_id, rec.item_id) on conflict do nothing;
    begin
      perform net.http_post(
        url := 'https://qbgeogmupdigvmywgdoi.supabase.co/functions/v1/push',
        body := jsonb_build_object('type', 'challenge_item', 'student_id', rec.student_id, 'item_id', rec.item_id),
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
    exception when others then
      null;
    end;
  end loop;
end $$;
revoke all on function public.challenge_reminders() from public, anon, authenticated;

-- Розклад запуску. Якщо pg_cron вимкнено, увімкніть: Supabase -> Database -> Extensions -> pg_cron.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'challenge-reminders';
  perform cron.schedule('challenge-reminders', '*/15 * * * *', 'select public.challenge_reminders()');
exception when others then
  raise notice 'pg_cron не налаштовано: %', sqlerrm;
end $$;

notify pgrst, 'reload schema';
