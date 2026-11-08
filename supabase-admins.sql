-- Керування адмінами з додатка. Supabase -> SQL Editor -> New query -> вставити все -> Run.
-- Можна запускати повторно. Потрібні supabase-schema.sql і supabase-onboarding.sql (уже виконані).
--
-- Власник = email із таблиці admin_emails (ти). Лише власник може призначати й знімати адмінів.
-- Адміна, який є власником, зняти не можна.

-- Хто з профілів власник (доступно адмінам, щоб показати позначку «Власник»)
create or replace function public.owner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where public.is_admin()
    and lower(coalesce(p.email, '')) in (select lower(email) from public.admin_emails);
$$;

-- Чи поточний користувач власник
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.admin_emails a on lower(a.email) = lower(coalesce(p.email, ''))
    where p.id = auth.uid()
  );
$$;

-- Призначити або зняти адміна. Перевірка власника відбувається тут, у базі, а не в додатку.
create or replace function public.set_admin_role(target uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_email text;
begin
  if not public.is_owner() then
    raise exception 'only owner can change roles' using errcode = '42501';
  end if;

  select email into target_email from public.profiles where id = target;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if lower(coalesce(target_email, '')) in (select lower(email) from public.admin_emails) then
    raise exception 'cannot change owner role' using errcode = '42501';
  end if;

  update public.profiles
  set role = case when make_admin then 'admin' else 'student' end
  where id = target;
end;
$$;

revoke all on function public.owner_ids()               from public, anon;
revoke all on function public.is_owner()                from public, anon;
revoke all on function public.set_admin_role(uuid, boolean) from public, anon;
grant execute on function public.owner_ids()               to authenticated;
grant execute on function public.is_owner()                to authenticated;
grant execute on function public.set_admin_role(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
