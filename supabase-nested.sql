-- Вкладені розділи (розділ у розділі без обмеження глибини) і позначка «Безкоштовно».
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Запускати ПІСЛЯ supabase-content.sql і supabase-payments.sql.
-- УВАГА: цей файл замінює get_content(). Якщо ви потім знову запустите supabase-content.sql,
-- запустіть supabase-nested.sql ще раз.
--
-- Правила доступу:
--  * доступ до розділу = доступ до всього всередині (підрозділи і вправи);
--  * «Безкоштовно» на розділі = безкоштовне все всередині, на вправі = лише ця вправа;
--  * окрема вправа може бути відкрита через пакет (exercise_access).

alter table public.content_sections add column if not exists parent_id text references public.content_sections (id) on delete cascade;
alter table public.content_sections add column if not exists free boolean not null default false;
alter table public.content_exercises add column if not exists free boolean not null default false;
alter table public.content_sections drop constraint if exists content_sections_parent_not_self;
alter table public.content_sections add constraint content_sections_parent_not_self check (parent_id is null or parent_id <> id);
create index if not exists content_sections_parent_idx on public.content_sections (parent_id, position);

-- Усі пари (розділ, він сам чи його предок).
create or replace function public.section_tree() returns table (id text, anc text)
language sql stable security definer set search_path = public as $$
  with recursive t(id, anc) as (
    select s.id, s.id from public.content_sections s
    union
    select t.id, p.parent_id from t join public.content_sections p on p.id = t.anc where p.parent_id is not null
  )
  select id, anc from t
$$;
revoke all on function public.section_tree() from public, anon, authenticated;

create or replace function public.get_content() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  adm boolean := coalesce(public.is_admin(), false);
  uid uuid := auth.uid();
begin
  return (
    with tr as (select * from public.section_tree()),
    vis as (  -- розділи, які бачить учень: опубліковані разом з усіма предками
      select s.id from public.content_sections s
      where s.published and not exists (
        select 1 from tr join public.content_sections a on a.id = tr.anc where tr.id = s.id and not a.published
      )
    ),
    opened as (  -- розділи, відкриті повністю: доступ або «безкоштовно» на ньому чи на предку
      select s.id from public.content_sections s
      where uid is not null and exists (
        select 1 from tr join public.content_sections a on a.id = tr.anc
        where tr.id = s.id and (
          a.free or exists (
            select 1 from public.section_access x where x.student_id = uid and x.section = a.id and x.expires_at > now()
          )
        )
      )
    ),
    okex as (  -- вправи, відкриті учню: безкоштовна, куплена окремо або в відкритому розділі
      select e.id from public.content_exercises e
      where uid is not null and e.published and (
        e.free
        or e.section_id in (select id from opened)
        or exists (select 1 from public.exercise_access x where x.student_id = uid and x.exercise_id = e.id and x.expires_at > now())
      )
    ),
    partial as (  -- розділи, у яких (разом з підрозділами) є хоч одна відкрита вправа
      select distinct tr.anc as id from tr join public.content_exercises e on e.section_id = tr.id
      where e.id in (select id from okex)
    )
    select jsonb_build_object(
      'sig', public.content_sig(),
      'sections', coalesce((
        select jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' order by s.position, s.created_at)
        from public.content_sections s where adm or s.id in (select id from vis)
      ), '[]'::jsonb),
      'exercises', coalesce((
        select jsonb_agg(
          case when adm or e.id in (select id from okex)
            then to_jsonb(e) - 'created_at' - 'updated_at'
            -- закрита вправа у частково відкритому розділі: лише назва із замком, без відео, опису й фото
            else jsonb_build_object('id', e.id, 'section_id', e.section_id, 'title', e.title, 'position', e.position,
                                    'published', e.published, 'free', false, 'locked', true)
          end order by e.position, e.created_at)
        from public.content_exercises e
        where adm or (
          uid is not null and e.published and e.section_id in (select id from vis)
          and (e.id in (select id from okex) or e.section_id in (select id from partial))
        )
      ), '[]'::jsonb),
      'order', coalesce((select to_jsonb(o.sections) from public.user_section_order o where o.user_id = uid), '[]'::jsonb)
    )
  );
end $$;
grant execute on function public.get_content() to anon, authenticated;

notify pgrst, 'reload schema';
