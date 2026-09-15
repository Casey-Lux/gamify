-- =============================================================================
-- 0009_mission_completions.sql
-- spec section 11 "Historial de misiones"
-- =============================================================================
-- No updated_at column and no UPDATE/DELETE grants for anyone but the schema
-- owner (see 0015_column_privileges.sql): this table is immutable, permanent
-- history. "El sistema debe conservar" the values awarded at the time, even if
-- the effect/multiplier that produced them later changes or disappears.

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

  -- A mission can only ever be completed once: enforced here at the database
  -- level (not just in RPC logic), directly satisfying "no duplicate
  -- completion" from spec section 45/55.
  constraint mission_completions_unique_mission unique (mission_id),
  constraint mission_completions_base_xp_non_negative check (base_xp >= 0),
  constraint mission_completions_xp_awarded_non_negative check (xp_awarded >= 0),
  constraint mission_completions_base_coins_non_negative check (base_coins >= 0),
  constraint mission_completions_coins_awarded_non_negative check (coins_awarded >= 0),
  constraint mission_completions_xp_multiplier_positive check (xp_multiplier > 0),
  constraint mission_completions_coin_multiplier_positive check (coin_multiplier > 0)
);

alter table public.mission_completions enable row level security;
