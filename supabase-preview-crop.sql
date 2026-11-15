-- Кадрування мініатюри-превʼю вправи ({"x":50,"y":50,"z":1}). Запусти один раз у Supabase -> SQL Editor.
alter table public.content_exercises add column if not exists preview_crop jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
