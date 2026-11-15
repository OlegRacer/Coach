-- Скільки днів на тиждень у програмі тренувань. Запусти один раз у SQL Editor (можна повторно).
alter table public.content_sections add column if not exists days_per_week smallint check (days_per_week between 1 and 7);
notify pgrst, 'reload schema';
