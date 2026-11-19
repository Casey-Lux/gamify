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
