create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_path  text,
  total_xp     integer not null default 0,
  level        integer not null default 1,
  coins        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_display_name_not_blank check (length(trim(display_name)) > 0),
  constraint profiles_total_xp_non_negative check (total_xp >= 0),
  constraint profiles_level_positive check (level >= 1),
  constraint profiles_coins_non_negative check (coins >= 0)
);

comment on table public.profiles is
  'One row per auth.users id. total_xp/level/coins are economy fields: never '
  'client-writable directly, only via SECURITY DEFINER RPCs (Fase 5/6).';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
