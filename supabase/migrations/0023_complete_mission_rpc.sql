-- =============================================================================
-- 0023_complete_mission_rpc.sql
-- Fase 5 "Completar misión" — spec section 13
--
-- Implements, in exact order, the 20 steps listed in the spec:
--   1  identificar auth.uid()
--   2  validar autenticación
--   3  validar autorización sobre la misión
--   4  bloquear las filas necesarias (missions + profiles FOR UPDATE)
--   5  comprobar que la misión no esté completada
--   6  comprobar todas las submisiones
--   7  obtener los efectos temporales activos del usuario
--   8  calcular multiplicadores
--   9  calcular XP efectivo
--   10 calcular monedas efectivas
--   11 marcar misión como completada
--   12 insertar mission_completions
--   13 actualizar player XP
--   14 actualizar player level          <- via the 0021 trigger, automatic
--   15 actualizar skill XP
--   16 actualizar skill level           <- via the 0021 trigger, automatic
--   17 incrementar coins
--   18 insertar wallet_transaction
--   19 devolver resultado completo
--   20 realizar todo atómicamente       <- the whole function IS one statement
--
-- "Debe ser imposible obtener doble recompensa ejecutando simultáneamente la
-- misma operación": guaranteed by TWO independent layers —
--   a) `SELECT ... FOR UPDATE` on the missions row makes a second concurrent
--      call BLOCK until the first transaction commits, then see
--      completed_at already set and raise GM004;
--   b) even if that were somehow bypassed, mission_completions has a
--      UNIQUE(mission_id) constraint (0009), so a second INSERT for the same
--      mission fails at the database level regardless.
-- =============================================================================

create or replace function public.complete_mission(p_mission_id uuid)
returns table (
  mission_id          uuid,
  completed_at        timestamptz,
  base_xp             integer,
  xp_multiplier       numeric,
  xp_flat_bonus       integer,
  xp_awarded          integer,
  base_coins          integer,
  coin_multiplier     numeric,
  coin_flat_bonus     integer,
  coins_awarded       integer,
  player_total_xp     integer,
  player_level        integer,
  player_leveled_up   boolean,
  player_coins        integer,
  skill_id            uuid,
  skill_xp            integer,
  skill_level         integer,
  skill_leveled_up    boolean
)
language plpgsql
security definer
set search_path = public
as $$
-- RETURNS TABLE columns become implicit plpgsql variables in scope for the
-- whole function body, which otherwise collide with real table columns of
-- the same name used inside queries (e.g. mission_subtasks.mission_id,
-- player_skills.skill_id, and — critically — an ON CONFLICT target list,
-- which cannot be table-qualified at all in standard SQL). This pragma
-- tells plpgsql to always prefer the table column in that ambiguity,
-- which is what every plain SQL reference in this function actually means;
-- the OUT parameters are only ever populated via the final `return query`.
#variable_conflict use_column
declare
  -- steps 1-2 ----------------------------------------------------------
  v_user_id uuid := auth.uid();

  -- the locked mission row (step 4/5/6)
  v_mission public.missions;

  -- step 7/8: latest non-expired effect per type, straight from
  -- consumable_activations.expires_at > now() (the server clock), never
  -- from consumable_activations.status and never from any client clock —
  -- spec section 16/33.
  v_xp_multiplier   numeric(6,2) := 1.00;
  v_coin_multiplier numeric(6,2) := 1.00;
  v_xp_flat_bonus   integer := 0;
  v_coin_flat_bonus integer := 0;

  -- steps 9-10
  v_base_xp        integer;
  v_base_coins     integer;
  v_xp_awarded     integer;
  v_coins_awarded  integer;

  -- before/after snapshots to compute *_leveled_up
  v_player_level_before integer;
  v_player_level_after  integer;
  v_player_total_xp_after integer;
  v_player_coins_after  integer;

  v_skill_level_before integer;
  v_skill_level_after  integer;
  v_skill_xp_after     integer;

  v_completed_at timestamptz;
begin
  -- ---------------------------------------------------------------------
  -- 1-2. identify + validate authentication
  -- ---------------------------------------------------------------------
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'GM001';
  end if;

  -- ---------------------------------------------------------------------
  -- 4. lock the mission row FIRST, before any authorization/state check,
  -- so a second concurrent call for the SAME mission blocks here until
  -- this transaction commits or rolls back.
  -- ---------------------------------------------------------------------
  select *
  into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if v_mission.id is null then
    raise exception 'mission not found' using errcode = 'GM003';
  end if;

  -- ---------------------------------------------------------------------
  -- 3. authorization: only the assignee can complete their own mission
  -- (documented secondary decision — completing is a personal act; the
  -- workspace OWNER and the mission's creator can manage/delete a mission
  -- but do not complete it on someone else's behalf). Re-verify current
  -- workspace membership too, in case it was revoked after assignment.
  -- ---------------------------------------------------------------------
  if v_mission.assigned_to <> v_user_id then
    raise exception 'not authorized to complete this mission' using errcode = 'GM002';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_mission.workspace_id and user_id = v_user_id
  ) then
    raise exception 'not authorized to complete this mission' using errcode = 'GM002';
  end if;

  -- ---------------------------------------------------------------------
  -- 5. not already completed. (Defense in depth: even if this check were
  -- ever bypassed, mission_completions_unique_mission — 0009 — would still
  -- reject the duplicate INSERT below.)
  -- ---------------------------------------------------------------------
  if v_mission.completed_at is not null then
    raise exception 'mission is already completed' using errcode = 'GM004';
  end if;

  -- ---------------------------------------------------------------------
  -- 6. all subtasks must be completed. A mission with zero subtasks has
  -- nothing to check, and is completable directly.
  -- ---------------------------------------------------------------------
  if exists (
    select 1 from public.mission_subtasks ms
    where ms.mission_id = p_mission_id and ms.completed = false
  ) then
    raise exception 'mission has incomplete subtasks' using errcode = 'GM005';
  end if;

  -- Lock the profile row too: serializes every economy-affecting operation
  -- for this user, and guarantees the RETURNING values read below reflect
  -- exactly this transaction's updates.
  perform 1 from public.profiles where id = v_user_id for update;

  -- ---------------------------------------------------------------------
  -- 7-8. active temporary effects -> multipliers/flat bonuses. For a given
  -- effect_type, at most one activation should ever be simultaneously
  -- active (purchase_item, Fase 6, replaces rather than stacks — spec
  -- section 17), but this picks the most recently activated one as a
  -- defensive tie-breaker if that invariant were ever violated. Multiple
  -- DIFFERENT effect_types stay independent, as required.
  -- ---------------------------------------------------------------------
  select effect_value into v_xp_multiplier
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'XP_MULTIPLIER' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_xp_multiplier := coalesce(v_xp_multiplier, 1.00);

  select effect_value into v_coin_multiplier
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'COIN_MULTIPLIER' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_coin_multiplier := coalesce(v_coin_multiplier, 1.00);

  select effect_value into v_xp_flat_bonus
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'XP_FLAT_BONUS' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_xp_flat_bonus := coalesce(v_xp_flat_bonus, 0);

  select effect_value into v_coin_flat_bonus
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'COIN_FLAT_BONUS' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_coin_flat_bonus := coalesce(v_coin_flat_bonus, 0);

  -- ---------------------------------------------------------------------
  -- 9-10. effective XP / coins. Documented secondary decision: a
  -- multiplier and a flat bonus of the same resource CAN be active at once
  -- (they are different effect_types — spec section 17 only forbids
  -- stacking within the SAME effect_type). Combination order: multiply the
  -- base first, then add the flat bonus. round() (half away from zero),
  -- matching the spec's own worked example: base 100 * 1.25 = 125 exactly.
  -- ---------------------------------------------------------------------
  v_base_xp := v_mission.xp_reward;
  v_base_coins := v_mission.coin_reward;

  v_xp_awarded := round(v_base_xp * v_xp_multiplier)::integer + v_xp_flat_bonus;
  v_coins_awarded := round(v_base_coins * v_coin_multiplier)::integer + v_coin_flat_bonus;

  if v_xp_awarded < 0 or v_coins_awarded < 0 then
    raise exception 'computed reward must not be negative' using errcode = 'GM008';
  end if;

  -- ---------------------------------------------------------------------
  -- 11. mark mission as completed.
  -- ---------------------------------------------------------------------
  update public.missions m
  set completed_at = now()
  where m.id = p_mission_id
  returning m.completed_at into v_completed_at;

  -- ---------------------------------------------------------------------
  -- 12. insert the immutable completion record (the historical, never-
  -- recalculated snapshot — spec section 34).
  -- ---------------------------------------------------------------------
  insert into public.mission_completions (
    mission_id, user_id, skill_id,
    base_xp, xp_multiplier, xp_flat_bonus, xp_awarded,
    base_coins, coin_multiplier, coin_flat_bonus, coins_awarded
  )
  values (
    p_mission_id, v_user_id, v_mission.skill_id,
    v_base_xp, v_xp_multiplier, v_xp_flat_bonus, v_xp_awarded,
    v_base_coins, v_coin_multiplier, v_coin_flat_bonus, v_coins_awarded
  );

  -- ---------------------------------------------------------------------
  -- 13-14. player XP + level. level is recomputed automatically by the
  -- profiles_before_write_sync_level trigger (0021) the instant total_xp
  -- changes — no separate write needed.
  -- ---------------------------------------------------------------------
  select level into v_player_level_before from public.profiles where id = v_user_id;

  update public.profiles
  set total_xp = total_xp + v_xp_awarded,
      coins = coins + v_coins_awarded
  where id = v_user_id
  returning total_xp, level, coins
  into v_player_total_xp_after, v_player_level_after, v_player_coins_after;

  -- ---------------------------------------------------------------------
  -- 15-16. skill XP + level, same automatic-sync pattern via the
  -- player_skills_before_write_sync_level trigger (0021). Upserts the row
  -- lazily: a user's first completion in a given skill creates it.
  -- ---------------------------------------------------------------------
  select ps.level into v_skill_level_before
  from public.player_skills ps
  where ps.user_id = v_user_id and ps.skill_id = v_mission.skill_id;
  v_skill_level_before := coalesce(v_skill_level_before, 1);

  insert into public.player_skills (user_id, skill_id, xp)
  values (v_user_id, v_mission.skill_id, v_xp_awarded)
  on conflict (user_id, skill_id)
  do update set xp = public.player_skills.xp + excluded.xp
  returning xp, level
  into v_skill_xp_after, v_skill_level_after;

  -- ---------------------------------------------------------------------
  -- 17 was folded into the single profiles UPDATE above (total_xp and
  -- coins together), which is simpler and no less correct than two
  -- separate UPDATE statements on the same row.
  --
  -- 18. wallet_transaction. wallet_transactions.amount has a "<> 0" check
  -- constraint (0010): a mission with 0 net coin reward legitimately
  -- produces no ledger entry, rather than an artificial zero-amount row.
  -- ---------------------------------------------------------------------
  if v_coins_awarded <> 0 then
    insert into public.wallet_transactions (user_id, amount, transaction_type, source_type, source_id)
    values (v_user_id, v_coins_awarded, 'MISSION_REWARD', 'mission', p_mission_id);
  end if;

  -- ---------------------------------------------------------------------
  -- 19. return the complete result.
  -- ---------------------------------------------------------------------
  return query
  select
    p_mission_id,
    v_completed_at,
    v_base_xp,
    v_xp_multiplier,
    v_xp_flat_bonus,
    v_xp_awarded,
    v_base_coins,
    v_coin_multiplier,
    v_coin_flat_bonus,
    v_coins_awarded,
    v_player_total_xp_after,
    v_player_level_after,
    v_player_level_after > v_player_level_before,
    v_player_coins_after,
    v_mission.skill_id,
    v_skill_xp_after,
    v_skill_level_after,
    v_skill_level_after > v_skill_level_before;
end;
$$;

comment on function public.complete_mission(uuid) is
  'THE only way a mission ever gets marked completed and its rewards ever '
  'granted. Atomic (single function call = single transaction), race-safe '
  '(SELECT ... FOR UPDATE + a UNIQUE constraint as a second line of '
  'defense), and re-validates subtask completeness server-side regardless '
  'of what the frontend''s Complete button shows.';

revoke all on function public.complete_mission(uuid) from public;
grant execute on function public.complete_mission(uuid) to authenticated;
