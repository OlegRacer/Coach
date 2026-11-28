-- Плитка «Калорії» на головній (як «Анатомія»). Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібні: supabase-content.sql, supabase-nested.sql (колонка free).
alter table public.content_sections drop constraint if exists content_sections_kind_check;
alter table public.content_sections add constraint content_sections_kind_check check (kind in ('exercises', 'anatomy', 'calories'));

insert into public.content_sections (id, kind, title, hint, icon, color, position, published, free)
values (
  'calories', 'calories',
  '{"uk": "Калорії", "en": "Calories", "zh-TW": "熱量"}'::jsonb,
  '{"uk": "Денна норма за вашими даними", "en": "Daily needs from your data", "zh-TW": "依你的資料計算每日需求"}'::jsonb,
  'scale', '#FFD27A',
  (select coalesce(max(position), 0) + 1 from public.content_sections where parent_id is null),
  true, true
) on conflict (id) do nothing;
