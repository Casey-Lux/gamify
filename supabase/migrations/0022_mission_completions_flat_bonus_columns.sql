-- =============================================================================
-- 0022_mission_completions_flat_bonus_columns.sql
-- Fase 5 "Completar misión"
-- =============================================================================
-- Documented secondary decision: spec section 34's worked example only shows
-- base_xp/xp_multiplier/xp_awarded, but section 15 defines FOUR effect types,
-- two of which (XP_FLAT_BONUS, COIN_FLAT_BONUS) are additive, not
-- multiplicative. Storing only the multiplier would silently lose the
-- breakdown whenever a flat bonus was also active at completion time —
-- inconsistent with the same section's own principle ("el sistema debe
-- conservar" what actually happened). Adding these two columns keeps the
-- full breakdown immutable, exactly like xp_multiplier already is.

alter table public.mission_completions
  add column xp_flat_bonus integer not null default 0,
  add column coin_flat_bonus integer not null default 0;

alter table public.mission_completions
  add constraint mission_completions_xp_flat_bonus_non_negative check (xp_flat_bonus >= 0),
  add constraint mission_completions_coin_flat_bonus_non_negative check (coin_flat_bonus >= 0);

comment on column public.mission_completions.xp_flat_bonus is
  'Flat XP bonus from an active XP_FLAT_BONUS consumable at completion time, '
  'already included in xp_awarded. 0 when no such effect was active.';
comment on column public.mission_completions.coin_flat_bonus is
  'Flat coin bonus from an active COIN_FLAT_BONUS consumable at completion '
  'time, already included in coins_awarded. 0 when no such effect was active.';
