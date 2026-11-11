-- Пам'ять: скільки місця займають база й файли, список файлів, невикористані файли. Лише для адмінів.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібні: supabase-schema.sql, supabase-content.sql, supabase-payments.sql, supabase-photo-gender.sql.

-- Учень може видалити файл (скріншот) зі своєї папки, коли скасовує заявку.
drop policy if exists payments_files_own_delete on storage.objects;
create policy payments_files_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'payments' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.storage_usage() returns jsonb
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'buckets', coalesce((
      select jsonb_object_agg(x.bucket_id, jsonb_build_object('bytes', x.b, 'files', x.n))
      from (
        select bucket_id, coalesce(sum((metadata ->> 'size')::bigint), 0) as b, count(*) as n
        from storage.objects group by bucket_id
      ) x
    ), '{}'::jsonb),
    'rows', jsonb_build_object(
      'profiles', (select count(*) from public.profiles),
      'student_details', (select count(*) from public.student_details),
      'payment_requests', (select count(*) from public.payment_requests),
      'content_exercises', (select count(*) from public.content_exercises)
    )
  );
end $$;

-- Файли відра з розмірами (до 5000 шт).
create or replace function public.storage_files(bucket text) returns table (name text, size bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
    from storage.objects o where o.bucket_id = storage_files.bucket
    order by o.created_at desc limit 5000;
end $$;

-- Файли, на які нічого не посилається (старші за годину, щоб не зачепити щойно завантажене).
create or replace function public.storage_orphans() returns table (bucket text, name text, size bigint)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select o.bucket_id, o.name, coalesce((o.metadata ->> 'size')::bigint, 0)
    from storage.objects o
    where o.created_at < now() - interval '1 hour'
      and (
        (o.bucket_id = 'content'
          and o.name not in (select e.preview from public.content_exercises e where e.preview <> '')
          and o.name not in (select p.qr_path from public.payment_settings p where p.qr_path <> ''))
        or (o.bucket_id = 'avatars'
          and o.name not in (select d.photo_path from public.student_details d where d.photo_path is not null))
        or (o.bucket_id = 'payments'
          and o.name not in (select r.proof_path from public.payment_requests r where r.proof_path <> ''))
      );
end $$;

revoke all on function public.storage_usage(), public.storage_files(text), public.storage_orphans() from public, anon;
grant execute on function public.storage_usage(), public.storage_files(text), public.storage_orphans() to authenticated;

notify pgrst, 'reload schema';
