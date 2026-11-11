-- Контент: розділи і вправи з бази (редагує тренер в адмінці).
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібні: supabase-schema.sql (profiles, is_admin) і supabase-access.sql (section_access).
-- Початкові розділи й вправи додаються в кінці (тільки якщо їх ще нема).

create table if not exists public.content_sections (
  id         text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  kind       text not null default 'exercises' check (kind in ('exercises', 'anatomy')),
  title      jsonb not null default '{}'::jsonb,   -- {"uk": "...", "en": "...", "zh-TW": "..."}
  hint       jsonb not null default '{}'::jsonb,
  icon       text not null default 'barbell',
  color      text not null default '#C6F432',
  position   int  not null default 0,
  published  boolean not null default false,        -- false = «в розробці», бачать лише адміни
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_exercises (
  id          text primary key check (id ~ '^[a-z0-9-]{1,60}$'),
  section_id  text not null references public.content_sections (id) on delete cascade,
  title       jsonb not null default '{}'::jsonb,
  description jsonb not null default '{}'::jsonb,
  sets        jsonb not null default '{}'::jsonb,
  muscles     text[] not null default '{}',
  preview     text not null default '',            -- фото/mp4: шлях у сховищі content або https-посилання
  video       text not null default '',            -- id відео YouTube (закрите посилання)
  position    int  not null default 0,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists content_exercises_section_idx on public.content_exercises (section_id, position);

-- Один рядок із номером версії контенту. Росте автоматично при будь-якій зміні.
create table if not exists public.content_meta (
  id      int primary key default 1 check (id = 1),
  version bigint not null default 1
);
insert into public.content_meta (id, version) values (1, 1) on conflict do nothing;

create or replace function public.content_bump() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.content_meta set version = version + 1 where id = 1;
  return null;
end $$;

drop trigger if exists content_sections_bump on public.content_sections;
create trigger content_sections_bump after insert or update or delete on public.content_sections
  for each statement execute function public.content_bump();
drop trigger if exists content_exercises_bump on public.content_exercises;
create trigger content_exercises_bump after insert or update or delete on public.content_exercises
  for each statement execute function public.content_bump();

-- Порядок розділів, який учень задав для себе.
create table if not exists public.user_section_order (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  sections   text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- Доступ до окремих вправ (коли розділ відкрито не повністю, наприклад за пакетом оплати).
create table if not exists public.exercise_access (
  student_id  uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null references public.content_exercises (id) on delete cascade,
  expires_at  timestamptz not null,
  granted_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (student_id, exercise_id)
);

-- Доступ учнів тепер до будь-яких розділів, а не лише до чотирьох початкових.
alter table public.section_access drop constraint if exists section_access_section_check;

alter table public.content_sections enable row level security;
alter table public.content_exercises enable row level security;
alter table public.content_meta enable row level security;
alter table public.user_section_order enable row level security;
alter table public.exercise_access enable row level security;

-- Напряму таблиці контенту читає і пише лише тренер. Учні отримують контент через get_content().
drop policy if exists content_sections_admin on public.content_sections;
create policy content_sections_admin on public.content_sections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists content_exercises_admin on public.content_exercises;
create policy content_exercises_admin on public.content_exercises
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists content_meta_admin on public.content_meta;
create policy content_meta_admin on public.content_meta
  for select to authenticated using (public.is_admin());

drop policy if exists exercise_access_select on public.exercise_access;
create policy exercise_access_select on public.exercise_access
  for select to authenticated using (student_id = auth.uid() or public.is_admin());
drop policy if exists exercise_access_admin on public.exercise_access;
create policy exercise_access_admin on public.exercise_access
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists order_own on public.user_section_order;
create policy order_own on public.user_section_order
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.content_sections, public.content_exercises, public.content_meta from anon;
revoke all on public.user_section_order, public.exercise_access from anon;

-- Короткий підпис стану: версія контенту + що відкрито цьому учню. Змінився, значить треба завантажити знімок.
create or replace function public.content_sig() returns text
language sql stable security definer set search_path = public as $$
  select (select version from public.content_meta where id = 1)::text || ':' ||
    case
      when auth.uid() is null then 'g'
      when coalesce(public.is_admin(), false) then 'a'
      else coalesce((
        select md5(string_agg(q.k || '=' || q.e, ',' order by q.k))
        from (
          select 's:' || a.section as k, a.expires_at::text as e
          from public.section_access a where a.student_id = auth.uid() and a.expires_at > now()
          union all
          select 'e:' || x.exercise_id, x.expires_at::text
          from public.exercise_access x where x.student_id = auth.uid() and x.expires_at > now()
        ) q
      ), 'n')
    end
$$;

-- Знімок контенту для додатка.
-- Тренер: усе, разом із чернетками. Учень: опубліковані розділи (назви бачить кожен, щоб показати замок),
-- а вправи лише з розділів, до яких зараз є доступ. Гість: лише список розділів.
create or replace function public.get_content() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  adm boolean := coalesce(public.is_admin(), false);
  uid uuid := auth.uid();
begin
  return jsonb_build_object(
    'sig', public.content_sig(),
    'sections', coalesce((
      select jsonb_agg(to_jsonb(s) - 'created_at' - 'updated_at' order by s.position, s.created_at)
      from public.content_sections s where adm or s.published
    ), '[]'::jsonb),
    'exercises', coalesce((
      select jsonb_agg(to_jsonb(e) - 'created_at' - 'updated_at' order by e.position, e.created_at)
      from public.content_exercises e
      join public.content_sections s on s.id = e.section_id
      where adm or (
        e.published and s.published and uid is not null and (
          exists (
            select 1 from public.section_access a
            where a.student_id = uid and a.section = s.id and a.expires_at > now()
          )
          or exists (
            select 1 from public.exercise_access x
            where x.student_id = uid and x.exercise_id = e.id and x.expires_at > now()
          )
        )
      )
    ), '[]'::jsonb),
    'order', coalesce((select to_jsonb(o.sections) from public.user_section_order o where o.user_id = uid), '[]'::jsonb)
  );
end $$;

grant execute on function public.content_sig() to anon, authenticated;
grant execute on function public.get_content() to anon, authenticated;

-- Сховище для фото й коротких mp4. Читати можна всім (посилання відкрите), писати лише тренеру.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', true, 31457280,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
on conflict (id) do update set public = true, file_size_limit = 31457280,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

drop policy if exists content_files_read on storage.objects;
create policy content_files_read on storage.objects for select using (bucket_id = 'content');
drop policy if exists content_files_admin on storage.objects;
create policy content_files_admin on storage.objects for all to authenticated
  using (bucket_id = 'content' and public.is_admin())
  with check (bucket_id = 'content' and public.is_admin());

-- Початкові дані (з поточних вправ додатка). Чіпає лише відсутні рядки.
insert into public.content_sections (id,kind,title,hint,icon,color,position,published) values ('fitness','exercises','{"uk": "Вправи фітнес", "en": "Fitness exercises", "zh-TW": "健身動作"}'::jsonb,'{"uk": "Силові та кардіо з відео", "en": "Strength and cardio with video", "zh-TW": "肌力與有氧，附示範影片"}'::jsonb,'barbell','#C6F432',0,true) on conflict (id) do nothing;
insert into public.content_sections (id,kind,title,hint,icon,color,position,published) values ('mfr','exercises','{"uk": "МФР ролл", "en": "Foam rolling", "zh-TW": "滾筒放鬆"}'::jsonb,'{"uk": "Масаж роликом, відновлення", "en": "Roller massage and recovery", "zh-TW": "筋膜滾筒按摩與恢復"}'::jsonb,'roller','#FF8A5B',1,true) on conflict (id) do nothing;
insert into public.content_sections (id,kind,title,hint,icon,color,position,published) values ('mobility','exercises','{"uk": "Мобільність", "en": "Mobility", "zh-TW": "活動度訓練"}'::jsonb,'{"uk": "Розтяжка та рухливість суглобів", "en": "Stretching and joint mobility", "zh-TW": "伸展與關節活動度"}'::jsonb,'mobility','#8FD3FF',2,true) on conflict (id) do nothing;
insert into public.content_sections (id,kind,title,hint,icon,color,position,published) values ('anatomy','anatomy','{"uk": "Анатомія тіла", "en": "Body anatomy", "zh-TW": "人體肌肉"}'::jsonb,'{"uk": "М''язи та вправи для них", "en": "Muscles and exercises for them", "zh-TW": "肌肉與對應的訓練動作"}'::jsonb,'anatomy','#C9B8FF',3,true) on conflict (id) do nothing;
insert into public.content_exercises (id,section_id,title,description,sets,muscles,preview,video,position,published) values ('pushup','fitness','{"uk": "Віджимання", "en": "Push-up", "zh-TW": "伏地挺身"}'::jsonb,'{"uk": "ПРИКЛАД. Замініть на свій опис техніки.", "en": "EXAMPLE. Replace with your own technique description.", "zh-TW": "範例。請改成你自己的動作說明。"}'::jsonb,'{"uk": "3 × 12", "en": "3 × 12", "zh-TW": "3 × 12"}'::jsonb,array['chest','shoulders','triceps']::text[],'','',0,true) on conflict (id) do nothing;
insert into public.content_exercises (id,section_id,title,description,sets,muscles,preview,video,position,published) values ('squat','fitness','{"uk": "Присідання", "en": "Squat", "zh-TW": "深蹲"}'::jsonb,'{"uk": "ПРИКЛАД. Замініть на свій опис техніки.", "en": "EXAMPLE. Replace with your own technique description.", "zh-TW": "範例。請改成你自己的動作說明。"}'::jsonb,'{"uk": "4 × 10", "en": "4 × 10", "zh-TW": "4 × 10"}'::jsonb,array['quads','glutes']::text[],'media/squat-demo.mp4','',1,true) on conflict (id) do nothing;
insert into public.content_exercises (id,section_id,title,description,sets,muscles,preview,video,position,published) values ('plank','fitness','{"uk": "Планка", "en": "Plank", "zh-TW": "棒式"}'::jsonb,'{"uk": "ПРИКЛАД. Замініть на свій опис техніки.", "en": "EXAMPLE. Replace with your own technique description.", "zh-TW": "範例。請改成你自己的動作說明。"}'::jsonb,'{"uk": "3 × 45 с", "en": "3 × 45 s", "zh-TW": "3 × 45 秒"}'::jsonb,array['abs']::text[],'','',2,true) on conflict (id) do nothing;
insert into public.content_exercises (id,section_id,title,description,sets,muscles,preview,video,position,published) values ('mfr-quads','mfr','{"uk": "МФР квадрицепсів", "en": "Quadriceps foam rolling", "zh-TW": "股四頭肌滾筒放鬆"}'::jsonb,'{"uk": "ПРИКЛАД. Замініть на свій опис техніки.", "en": "EXAMPLE. Replace with your own technique description.", "zh-TW": "範例。請改成你自己的動作說明。"}'::jsonb,'{"uk": "1–2 хв на ногу", "en": "1–2 min per leg", "zh-TW": "每側 1–2 分鐘"}'::jsonb,array['quads']::text[],'','',3,true) on conflict (id) do nothing;
insert into public.content_exercises (id,section_id,title,description,sets,muscles,preview,video,position,published) values ('mfr-back','mfr','{"uk": "МФР верху спини", "en": "Upper back foam rolling", "zh-TW": "上背滾筒放鬆"}'::jsonb,'{"uk": "ПРИКЛАД. Замініть на свій опис техніки.", "en": "EXAMPLE. Replace with your own technique description.", "zh-TW": "範例。請改成你自己的動作說明。"}'::jsonb,'{"uk": "1–2 хв", "en": "1–2 min", "zh-TW": "1–2 分鐘"}'::jsonb,array['back']::text[],'','',4,true) on conflict (id) do nothing;
insert into public.content_exercises (id,section_id,title,description,sets,muscles,preview,video,position,published) values ('hip-opener','mobility','{"uk": "Відкриття тазостегнових", "en": "Hip opener", "zh-TW": "開髖伸展"}'::jsonb,'{"uk": "ПРИКЛАД. Замініть на свій опис техніки.", "en": "EXAMPLE. Replace with your own technique description.", "zh-TW": "範例。請改成你自己的動作說明。"}'::jsonb,'{"uk": "2 × 30 с", "en": "2 × 30 s", "zh-TW": "2 × 30 秒"}'::jsonb,array['glutes','quads']::text[],'','',5,true) on conflict (id) do nothing;
insert into public.content_exercises (id,section_id,title,description,sets,muscles,preview,video,position,published) values ('thoracic-rotation','mobility','{"uk": "Ротація грудного відділу", "en": "Thoracic rotation", "zh-TW": "胸椎旋轉"}'::jsonb,'{"uk": "ПРИКЛАД. Замініть на свій опис техніки.", "en": "EXAMPLE. Replace with your own technique description.", "zh-TW": "範例。請改成你自己的動作說明。"}'::jsonb,'{"uk": "2 × 10", "en": "2 × 10", "zh-TW": "2 × 10"}'::jsonb,array['back','shoulders']::text[],'','',6,true) on conflict (id) do nothing;

notify pgrst, 'reload schema';
