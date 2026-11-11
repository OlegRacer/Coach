-- Оплата переказом (LINE Pay на особистий акаунт): пакети доступу, реквізити, заявки «Я оплатив».
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібні: supabase-schema.sql, supabase-access.sql, supabase-content.sql.

-- Пакети: які розділи, на скільки днів, за яку ціну.
create table if not exists public.access_plans (
  id          uuid primary key default gen_random_uuid(),
  title       jsonb not null default '{}'::jsonb,        -- {"uk","en","zh-TW"}
  description jsonb not null default '{}'::jsonb,
  sections    text[] not null default '{}',              -- id розділів з content_sections
  days        int not null check (days between 1 and 3650),
  price       numeric(10,2) not null check (price >= 0),
  currency    text not null default 'TWD',
  position    int not null default 0,
  active      boolean not null default false,            -- false = чернетка, учні не бачать
  created_at  timestamptz not null default now()
);

-- Реквізити для переказу. Один рядок.
create table if not exists public.payment_settings (
  id           int primary key default 1 check (id = 1),
  line_id      text not null default '' check (char_length(line_id) <= 100),
  qr_path      text not null default '',                 -- файл у сховищі content
  instructions jsonb not null default '{}'::jsonb,       -- текст «як платити», 3 мови
  updated_at   timestamptz not null default now()
);
insert into public.payment_settings (id) values (1) on conflict do nothing;

-- Заявки «Я оплатив». plan — знімок пакета на момент заявки (щоб зміна ціни не чіпала старі заявки).
create table if not exists public.payment_requests (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  plan_id       uuid references public.access_plans (id) on delete set null,
  plan          jsonb not null,                          -- {title, sections, days, price, currency}
  note          text not null default '' check (char_length(note) <= 1000),
  proof_path    text not null default '',                -- скріншот у сховищі payments
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text not null default '' check (char_length(reject_reason) <= 500),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles (id) on delete set null
);
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at desc);
create index if not exists payment_requests_student_idx on public.payment_requests (student_id, created_at desc);

alter table public.access_plans enable row level security;
alter table public.payment_settings enable row level security;
alter table public.payment_requests enable row level security;

-- Пакети: активні бачить кожен учень, усе й зміни тільки тренер.
drop policy if exists plans_select on public.access_plans;
create policy plans_select on public.access_plans
  for select to authenticated using (active or public.is_admin());
drop policy if exists plans_admin on public.access_plans;
create policy plans_admin on public.access_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Реквізити: читають усі авторизовані, міняє тренер.
drop policy if exists pay_settings_select on public.payment_settings;
create policy pay_settings_select on public.payment_settings
  for select to authenticated using (true);
drop policy if exists pay_settings_admin on public.payment_settings;
create policy pay_settings_admin on public.payment_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Заявки: учень створює й бачить свої (статус лише pending), тренер бачить усі. Рішення тільки через функції нижче.
drop policy if exists requests_select on public.payment_requests;
create policy requests_select on public.payment_requests
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
drop policy if exists requests_insert on public.payment_requests;
create policy requests_insert on public.payment_requests
  for insert to authenticated with check (student_id = auth.uid() and status = 'pending');
drop policy if exists requests_delete on public.payment_requests;
create policy requests_delete on public.payment_requests
  for delete to authenticated using ((student_id = auth.uid() and status = 'pending') or public.is_admin());

revoke all on public.access_plans, public.payment_settings, public.payment_requests from anon;

-- Підтвердити: відкриває доступ до розділів пакета (продовжує від max(зараз, поточний кінець)).
create or replace function public.approve_payment(request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.payment_requests;
  d int;
  s text;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into r from public.payment_requests where id = request_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status <> 'pending' then raise exception 'already_decided'; end if;
  d := (r.plan ->> 'days')::int;
  for s in select jsonb_array_elements_text(r.plan -> 'sections') loop
    insert into public.section_access (student_id, section, expires_at, granted_by, updated_at)
    values (
      r.student_id, s,
      greatest(now(), coalesce((select a.expires_at from public.section_access a where a.student_id = r.student_id and a.section = s), now())) + make_interval(days => d),
      auth.uid(), now()
    )
    on conflict (student_id, section) do update
      set expires_at = excluded.expires_at, granted_by = excluded.granted_by, updated_at = now();
  end loop;
  update public.payment_requests
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = request_id;
end $$;

create or replace function public.reject_payment(request_id uuid, reason text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.payment_requests
    set status = 'rejected', reject_reason = left(coalesce(reason, ''), 500), decided_at = now(), decided_by = auth.uid()
    where id = request_id and status = 'pending';
  if not found then raise exception 'not_pending'; end if;
end $$;

revoke all on function public.approve_payment(uuid), public.reject_payment(uuid, text) from public, anon;
grant execute on function public.approve_payment(uuid), public.reject_payment(uuid, text) to authenticated;

-- Скріншоти переказів: приватне сховище. Учень пише й читає лише в своїй папці <його id>/, тренер читає все.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payments', 'payments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists payments_files_insert on storage.objects;
create policy payments_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'payments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists payments_files_select on storage.objects;
create policy payments_files_select on storage.objects for select to authenticated
  using (bucket_id = 'payments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists payments_files_admin_delete on storage.objects;
create policy payments_files_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payments' and public.is_admin());

notify pgrst, 'reload schema';
