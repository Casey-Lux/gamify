-- =============================================================================
-- supabase/tests/complete_mission_test.sql
-- Fase 12 — spec sección 44 "Database tests": complete_mission, duplicate
-- completion, effect (XP multiplier / coin multiplier / flat bonus)
-- application, effect expiration.
--
-- Requires _harness.sql and every migration already applied (see
-- run_db_tests.sh). Wrapped in BEGIN/ROLLBACK: leaves no data behind, safe
-- to re-run against the same database as many times as needed.
-- =============================================================================
begin;

do $$
declare
  v_owner    uuid := '00000000-0000-0000-0000-0000000000b1'; -- creates + owns the workspace, assigns missions to itself
  v_outsider uuid := '00000000-0000-0000-0000-0000000000b2'; -- workspace member, never assigned anything (for GM002)
  v_ws       uuid;
  v_skill    uuid;
  v_item_xp_mult  uuid;
  v_item_xp_flat  uuid;
  v_item_coin_mult uuid;
  v_item_coin_flat uuid;
  v_mission_easy  uuid;
  v_mission_subtasked uuid;
  v_mission_zero_coins uuid;
  v_mission_coin_effects uuid;
  v_sub1 uuid;
  v_sub2 uuid;
  v_row record;
begin
  -- -------------------------------------------------------------------
  -- fixtures (as postgres, bypassing RLS — same rationale as seed.sql)
  -- -------------------------------------------------------------------
  perform tests.create_user(v_owner, 'cm-owner@test.dev', 'Owner');
  perform tests.create_user(v_outsider, 'cm-outsider@test.dev', 'Outsider');

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'CM Workspace', false, v_owner)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, v_owner, 'OWNER'), (v_ws, v_outsider, 'MEMBER');

  insert into public.skills (id, workspace_id, name)
  values (gen_random_uuid(), v_ws, 'Fitness')
  returning id into v_skill;

  insert into public.store_items
    (id, workspace_id, name, price, stock, effect_type, effect_value, duration_minutes)
  values
    (gen_random_uuid(), v_ws, 'XP Potion', 10, 5, 'XP_MULTIPLIER', 1.25, 15)
  returning id into v_item_xp_mult;

  insert into public.store_items
    (id, workspace_id, name, price, stock, effect_type, effect_value, duration_minutes)
  values
    (gen_random_uuid(), v_ws, 'XP Booster', 10, 5, 'XP_FLAT_BONUS', 20, 15)
  returning id into v_item_xp_flat;

  insert into public.store_items
    (id, workspace_id, name, price, stock, effect_type, effect_value, duration_minutes)
  values
    (gen_random_uuid(), v_ws, 'Coin Doubler', 10, 5, 'COIN_MULTIPLIER', 2.00, 15)
  returning id into v_item_coin_mult;

  insert into public.store_items
    (id, workspace_id, name, price, stock, effect_type, effect_value, duration_minutes)
  values
    (gen_random_uuid(), v_ws, 'Coin Booster', 10, 5, 'COIN_FLAT_BONUS', 5, 15)
  returning id into v_item_coin_flat;

  -- Mission with no subtasks, base 100 XP / 10 coins — the happy path.
  insert into public.missions
    (id, workspace_id, created_by, assigned_to, skill_id, title, difficulty, xp_reward, coin_reward)
  values
    (gen_random_uuid(), v_ws, v_owner, v_owner, v_skill, 'Run 5k', 'MEDIUM', 100, 10)
  returning id into v_mission_easy;

  -- Mission with two subtasks, one left incomplete (for GM005).
  insert into public.missions
    (id, workspace_id, created_by, assigned_to, skill_id, title, difficulty, xp_reward, coin_reward)
  values
    (gen_random_uuid(), v_ws, v_owner, v_owner, v_skill, 'Clean the house', 'EASY', 30, 5)
  returning id into v_mission_subtasked;

  insert into public.mission_subtasks (id, mission_id, title, completed)
  values (gen_random_uuid(), v_mission_subtasked, 'Vacuum', true)
  returning id into v_sub1;
  insert into public.mission_subtasks (id, mission_id, title, completed)
  values (gen_random_uuid(), v_mission_subtasked, 'Dishes', false)
  returning id into v_sub2;

  -- Mission with zero coin_reward (for the "no wallet_transactions row"
  -- assertion — wallet_transactions.amount has a `<> 0` check constraint).
  insert into public.missions
    (id, workspace_id, created_by, assigned_to, skill_id, title, difficulty, xp_reward, coin_reward)
  values
    (gen_random_uuid(), v_ws, v_owner, v_owner, v_skill, 'Read a chapter', 'EASY', 15, 0)
  returning id into v_mission_zero_coins;

  -- Mission for the COIN_MULTIPLIER + COIN_FLAT_BONUS case, base 40 coins.
  insert into public.missions
    (id, workspace_id, created_by, assigned_to, skill_id, title, difficulty, xp_reward, coin_reward)
  values
    (gen_random_uuid(), v_ws, v_owner, v_owner, v_skill, 'Coin effects mission', 'EASY', 5, 40)
  returning id into v_mission_coin_effects;

  -- =====================================================================
  -- GM001: not authenticated (authenticated role, but no JWT claim).
  -- =====================================================================
  perform tests.become_authenticated_without_claim();
  perform tests.assert_raises(
    format('select public.complete_mission(%L::uuid)', v_mission_easy),
    'GM001', 'GM001: no auth.uid()'
  );
  perform tests.logout();

  -- =====================================================================
  -- GM003: mission does not exist.
  -- =====================================================================
  perform tests.login_as(v_owner);
  perform tests.assert_raises(
    'select public.complete_mission(''00000000-0000-0000-0000-000000000000''::uuid)',
    'GM003', 'GM003: mission not found'
  );

  -- =====================================================================
  -- GM002: authenticated, but not the assignee.
  -- =====================================================================
  perform tests.logout();
  perform tests.login_as(v_outsider);
  perform tests.assert_raises(
    format('select public.complete_mission(%L::uuid)', v_mission_easy),
    'GM002', 'GM002: not the assignee'
  );

  -- =====================================================================
  -- GM005: incomplete subtasks block completion.
  -- =====================================================================
  perform tests.logout();
  perform tests.login_as(v_owner);
  perform tests.assert_raises(
    format('select public.complete_mission(%L::uuid)', v_mission_subtasked),
    'GM005', 'GM005: incomplete subtasks'
  );

  -- Finish the remaining subtask and confirm it now completes cleanly.
  update public.mission_subtasks set completed = true where id = v_sub2;
  select * into v_row from public.complete_mission(v_mission_subtasked);
  assert v_row.xp_awarded = 30, format('subtasked mission: expected 30 xp, got %s', v_row.xp_awarded);
  assert v_row.coins_awarded = 5, format('subtasked mission: expected 5 coins, got %s', v_row.coins_awarded);

  -- =====================================================================
  -- Zero-coin mission: no wallet_transactions row is created (the check
  -- constraint makes a zero-amount row impossible, and the RPC must not
  -- even attempt one — spec section 12).
  -- =====================================================================
  perform tests.logout();
  perform tests.login_as(v_owner);
  perform public.complete_mission(v_mission_zero_coins);
  perform tests.assert_empty(
    format('select 1 from public.wallet_transactions where source_type = ''mission'' and source_id = %L', v_mission_zero_coins),
    'zero-coin mission must not create a wallet_transactions row'
  );

  -- =====================================================================
  -- Happy path + effect application: an active XP_MULTIPLIER (1.25x) and
  -- an active XP_FLAT_BONUS (+20) apply SIMULTANEOUSLY (different
  -- effect_types, spec section 17 only forbids stacking the SAME type) —
  -- multiply first, then add: round(100 * 1.25) + 20 = 145.
  -- =====================================================================
  perform tests.logout();

  insert into public.consumable_activations
    (id, user_id, item_id, effect_type, effect_value, activated_at, expires_at, status)
  values
    (gen_random_uuid(), v_owner, v_item_xp_mult, 'XP_MULTIPLIER', 1.25, now(), now() + interval '10 minutes', 'ACTIVE'),
    (gen_random_uuid(), v_owner, v_item_xp_flat, 'XP_FLAT_BONUS', 20, now(), now() + interval '10 minutes', 'ACTIVE');

  -- An EXPIRED activation of a THIRD, unrelated effect type must be ignored
  -- even though a row for it exists (spec: "un efecto ya expirado se
  -- ignora aunque exista una fila más antigua del mismo tipo" — here
  -- exercised on COIN_MULTIPLIER, which this mission doesn't even use, to
  -- confirm an expired row never leaks into ANY calculation).
  insert into public.consumable_activations
    (id, user_id, item_id, effect_type, effect_value, activated_at, expires_at, status)
  values
    (gen_random_uuid(), v_owner, v_item_xp_mult, 'COIN_MULTIPLIER', 2.00, now() - interval '20 minutes', now() - interval '10 minutes', 'EXPIRED');

  perform tests.login_as(v_owner);
  select * into v_row from public.complete_mission(v_mission_easy);

  assert v_row.base_xp = 100, format('expected base_xp 100, got %s', v_row.base_xp);
  assert v_row.xp_multiplier = 1.25, format('expected xp_multiplier 1.25, got %s', v_row.xp_multiplier);
  assert v_row.xp_flat_bonus = 20, format('expected xp_flat_bonus 20, got %s', v_row.xp_flat_bonus);
  assert v_row.xp_awarded = 145, format('expected xp_awarded 145 (round(100*1.25)+20), got %s', v_row.xp_awarded);
  assert v_row.base_coins = 10, format('expected base_coins 10, got %s', v_row.base_coins);
  assert v_row.coin_multiplier = 1.00, format('expected coin_multiplier 1.00 (no active coin effect), got %s', v_row.coin_multiplier);
  assert v_row.coins_awarded = 10, format('expected coins_awarded 10 (no coin effect active), got %s', v_row.coins_awarded);
  assert v_row.player_leveled_up = true, 'expected player_leveled_up = true (0 xp -> 145+30+15 xp so far)';

  -- Player totals: 30 (subtasked) + 15 (zero-coin) + 145 (this one) = 190.
  assert v_row.player_total_xp = 190, format('expected player_total_xp 190, got %s', v_row.player_total_xp);
  assert v_row.player_coins = 15, format('expected player_coins 15 (5 + 0 + 10), got %s', v_row.player_coins);
  assert v_row.player_level = public.calculate_level(190),
    'player_level must match calculate_level(total_xp) — never a client-side recomputation';

  -- Skill XP/level mirror the same total (all three missions used the same skill).
  assert v_row.skill_xp = 190, format('expected skill_xp 190, got %s', v_row.skill_xp);
  assert v_row.skill_level = public.calculate_level(190), 'skill_level must match calculate_level(skill xp)';

  assert (select count(*) from public.mission_completions) = 3,
    format('expected exactly 3 mission_completions rows (subtasked + zero-coin + xp-effect), got %s',
      (select count(*) from public.mission_completions));

  -- =====================================================================
  -- COIN_MULTIPLIER + COIN_FLAT_BONUS: the mirror image of the XP case
  -- above, on the coin side — round(40 * 2.00) + 5 = 85.
  -- =====================================================================
  perform tests.logout();

  insert into public.consumable_activations
    (id, user_id, item_id, effect_type, effect_value, activated_at, expires_at, status)
  values
    (gen_random_uuid(), v_owner, v_item_coin_mult, 'COIN_MULTIPLIER', 2.00, now(), now() + interval '10 minutes', 'ACTIVE'),
    (gen_random_uuid(), v_owner, v_item_coin_flat, 'COIN_FLAT_BONUS', 5, now(), now() + interval '10 minutes', 'ACTIVE');

  perform tests.login_as(v_owner);
  select * into v_row from public.complete_mission(v_mission_coin_effects);

  assert v_row.base_coins = 40, format('expected base_coins 40, got %s', v_row.base_coins);
  assert v_row.coin_multiplier = 2.00, format('expected coin_multiplier 2.00, got %s', v_row.coin_multiplier);
  assert v_row.coin_flat_bonus = 5, format('expected coin_flat_bonus 5, got %s', v_row.coin_flat_bonus);
  assert v_row.coins_awarded = 85, format('expected coins_awarded 85 (round(40*2.00)+5), got %s', v_row.coins_awarded);
  -- The XP-multiplier/flat-bonus activations from the block above already
  -- expired only in the sense of being superseded by nothing (different
  -- effect_type, so they're still simultaneously active) — this mission's
  -- own xp_reward (5) has no active XP effect of its own kind here beyond
  -- the still-active XP_MULTIPLIER/XP_FLAT_BONUS from before, confirming
  -- effects persist across multiple completions until they actually expire.
  assert v_row.xp_awarded = round(5 * 1.25)::integer + 20,
    format('expected xp_awarded %s (the still-active XP effects from earlier apply here too), got %s',
      round(5 * 1.25)::integer + 20, v_row.xp_awarded);

  -- =====================================================================
  -- GM004: cannot complete an already-completed mission (duplicate
  -- completion, non-concurrent case — the true race is in
  -- concurrency_test.sh).
  -- =====================================================================
  perform tests.assert_raises(
    format('select public.complete_mission(%L::uuid)', v_mission_easy),
    'GM004', 'GM004: duplicate completion'
  );

  -- Defense in depth: even bypassing the RPC entirely, the UNIQUE
  -- constraint on mission_completions(mission_id) alone would reject a
  -- second row for the same mission (spec section 45/55).
  perform tests.logout();
  perform tests.assert_raises(
    format(
      'insert into public.mission_completions (mission_id, user_id, skill_id, base_xp, xp_awarded, base_coins, coins_awarded) values (%L, %L, %L, 1, 1, 0, 0)',
      v_mission_easy, v_owner, v_skill
    ),
    '23505', 'mission_completions_unique_mission constraint'
  );

  raise notice 'complete_mission_test.sql: all assertions passed';
end;
$$;

rollback;
