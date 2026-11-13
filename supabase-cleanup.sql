-- Видалення акаунта учня (разом з усіма його даними). Лише для адмінів.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Видаляє запис у auth.users; усі таблиці учня (анкета, доступи, пакети, оплати, підписки) зникають каскадом.
-- Адміна і себе видалити не можна. Файли (фото, скріншоти) додаток прибирає сам через Storage API.

create or replace function public.delete_student(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'cannot_delete_self';
  end if;
  if exists (select 1 from public.profiles where id = p_id and role = 'admin') then
    raise exception 'cannot_delete_admin';
  end if;
  delete from auth.users where id = p_id;
end $$;
revoke all on function public.delete_student(uuid) from public, anon;
grant execute on function public.delete_student(uuid) to authenticated;

notify pgrst, 'reload schema';
