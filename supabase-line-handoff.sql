-- Передача коду LINE з браузера у встановлений додаток (iPhone). Доступ лише для Edge Function (service role).
create table if not exists public.line_handoff (
  state text primary key,
  code text not null,
  created_at timestamptz not null default now()
);
alter table public.line_handoff enable row level security;
