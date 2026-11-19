create table public.mission_completions (
  id             uuid primary key default gen_random_uuid(),
  mission_id     uuid not null references public.missions (id) on delete restrict,
  user_id        uuid not null references public.profiles (id) on delete restrict,
  skill_id       uuid not null references public.skills (id) on delete restrict,
  base_xp        integer not null,
  xp_multiplier  numeric(6,2) not null default 1.00,
  xp_awarded     integer not null,
  base_coins     integer not null,
  coin_multiplier numeric(6,2) not null default 1.00,
  coins_awarded  integer not null,
  completed_at   timestamptz not null default now(),

  constraint mission_completions_unique_mission unique (mission_id),
  constraint mission_completions_base_xp_non_negative check (base_xp >= 0),
  constraint mission_completions_xp_awarded_non_negative check (xp_awarded >= 0),
  constraint mission_completions_base_coins_non_negative check (base_coins >= 0),
  constraint mission_completions_coins_awarded_non_negative check (coins_awarded >= 0),
  constraint mission_completions_xp_multiplier_positive check (xp_multiplier > 0),
  constraint mission_completions_coin_multiplier_positive check (coin_multiplier > 0)
);

alter table public.mission_completions enable row level security;
