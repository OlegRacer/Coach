-- Підходи й повтори для вправ програми тренувань: {"<id вправи>": {"s":"4","r":"10"}}. Запусти один раз у Supabase -> SQL Editor.
alter table public.content_sections add column if not exists program_sets jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
