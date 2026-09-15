-- =============================================================================
-- 0020_level_calculation.sql
-- Fase 4 "skills, player_skills, level calculation"
-- spec section 7 "Niveles"
--
-- A single, centralized, deterministic, pure function family — used by BOTH
-- player level and skill level (spec: "misma fórmula para player level y
-- skill level"), and callable directly by the frontend via RPC so the
-- formula is never reimplemented in TypeScript ("no duplicarse", "poder
-- modificarse posteriormente desde un único punto": changing the game's
-- balance later means editing this one file and nothing else).
--
-- Documented secondary decision — the exact formula (spec only asks for "a
-- simple progression based on accumulated XP" with two properties: level 1 =
-- 0 XP, and each subsequent level costs more than the previous one):
--
--   xp_for_level(L) = 50 * (L - 1) * L        for L >= 1, xp_for_level(1) = 0
--
-- This is a triangular-number progression: the XP COST of each individual
-- level step grows linearly (level 1→2 costs 100, 2→3 costs 200, 3→4 costs
-- 300, ...), which satisfies "cada nivel posterior requiere más XP que el
-- anterior" while staying easy to explain, easy to test, and cheap to invert
-- exactly in integer arithmetic (no floating-point edge cases at thresholds).
-- =============================================================================

-- Total accumulated XP required to REACH level p_level (i.e. the threshold at
-- which calculate_level() switches from p_level - 1 to p_level).
create or replace function public.xp_for_level(p_level integer)
returns integer
language plpgsql
immutable
as $$
begin
  if p_level is null or p_level < 1 then
    raise exception 'level must be an integer >= 1' using errcode = '22023';
  end if;

  if p_level = 1 then
    return 0;
  end if;

  return 50 * (p_level - 1) * p_level;
end;
$$;

comment on function public.xp_for_level(integer) is
  'Total accumulated XP needed to reach a given level. Pure/immutable: same '
  'input always gives the same output, no table access. The single source '
  'of truth for the XP curve — see 0020_level_calculation.sql header.';

-- Given accumulated XP, returns the current level. Implemented as a simple
-- iterative search (not a closed-form sqrt formula) specifically to avoid any
-- floating-point rounding risk exactly at a level threshold — correctness at
-- boundaries matters more here than micro-performance, and level counts in
-- this game are always small enough that the loop is effectively O(1).
create or replace function public.calculate_level(p_total_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  v_level integer := 1;
begin
  if p_total_xp is null or p_total_xp < 0 then
    raise exception 'total_xp must be a non-negative integer' using errcode = '22023';
  end if;

  while public.xp_for_level(v_level + 1) <= p_total_xp loop
    v_level := v_level + 1;
  end loop;

  return v_level;
end;
$$;

comment on function public.calculate_level(integer) is
  'THE single deterministic level formula, shared by profiles.level and '
  'player_skills.level (spec: "misma fórmula para player level y skill '
  'level"). Never reimplement this in the frontend — call it (or '
  'calculate_level_progress) via RPC instead.';

-- Everything the UI needs to render "nivel actual / XP actual / XP necesaria
-- para siguiente nivel / porcentaje de progreso" (spec section 7), in one
-- call, so the frontend never has to re-derive any of it itself.
create or replace function public.calculate_level_progress(p_total_xp integer)
returns table (
  level                     integer,
  xp_into_level             integer,
  xp_for_next_level         integer,
  xp_needed_for_next_level  integer,
  progress_percent          numeric
)
language plpgsql
immutable
as $$
declare
  v_level             integer;
  v_current_threshold integer;
  v_next_threshold    integer;
begin
  v_level := public.calculate_level(p_total_xp);
  v_current_threshold := public.xp_for_level(v_level);
  v_next_threshold := public.xp_for_level(v_level + 1);

  level := v_level;
  xp_into_level := p_total_xp - v_current_threshold;
  xp_for_next_level := v_next_threshold - v_current_threshold;
  xp_needed_for_next_level := v_next_threshold - p_total_xp;
  progress_percent := round(
    (xp_into_level::numeric / nullif(xp_for_next_level, 0)) * 100,
    2
  );

  return next;
end;
$$;

comment on function public.calculate_level_progress(integer) is
  'Convenience wrapper around calculate_level()/xp_for_level() for UI '
  'rendering. Pure function of total_xp — call with a profile''s total_xp or '
  'a player_skills row''s xp; the same formula applies to both.';

-- These are pure computations with no table access: safe to expose to every
-- authenticated client, and there is nothing sensitive to protect by
-- restricting who may call them.
revoke all on function public.xp_for_level(integer) from public;
revoke all on function public.calculate_level(integer) from public;
revoke all on function public.calculate_level_progress(integer) from public;

grant execute on function public.xp_for_level(integer) to authenticated;
grant execute on function public.calculate_level(integer) to authenticated;
grant execute on function public.calculate_level_progress(integer) to authenticated;
