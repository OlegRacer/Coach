-- Кілька відео на вправу, з початком/кінцем фрагмента і кількістю повторів.
-- Supabase -> SQL Editor -> New query -> вставити все -> Run. Можна запускати повторно.
-- Потрібна таблиця content_exercises з supabase-content.sql.
-- Формат videos: [{"id":"<код YouTube>","label":{"uk":"","en":"","zh-TW":""},"start":0,"end":0,"loops":1}]
-- end = 0: до кінця відео. loops = 0: безкінечно.

alter table public.content_exercises add column if not exists videos jsonb not null default '[]'::jsonb;

-- Перенесення старого одного відео у новий список (лише там, де список ще порожній).
update public.content_exercises
set videos = jsonb_build_array(jsonb_build_object('id', video, 'label', '{}'::jsonb, 'start', 0, 'end', 0, 'loops', 1))
where video <> '' and videos = '[]'::jsonb;

notify pgrst, 'reload schema';
