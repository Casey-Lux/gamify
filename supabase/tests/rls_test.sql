-- =============================================================================
-- supabase/tests/rls_test.sql
-- Fase 12 — spec sección 44 "Database tests": RLS, acceso no autorizado a un
-- workspace, acceso cruzado entre usuarios.
--
-- Requires _harness.sql and every migration already applied (see
-- run_db_tests.sh). Wrapped in BEGIN/ROLLBACK: leaves no data behind.
--
-- A SELECT that RLS filters out never raises an error — it silently
-- returns zero rows — so those cases use tests.assert_empty. An
-- INSERT/UPDATE/DELETE that RLS (or the 0015 column-privilege GRANTs)
-- rejects DOES raise (permission denied / row-level security violation,
-- SQLSTATE 42501) — those use tests.assert_raises.
-- =============================================================================
begin;

do $$
declare
  v_alice uuid := '00000000-0000-0000-0000-0000000000d1'; -- OWNER of workspace W1
  v_bob   uuid := '00000000-0000-0000-0000-0000000000d2'; -- MEMBER of workspace W1
  v_carol uuid := '00000000-0000-0000-0000-0000000000d3'; -- OWNER of an unrelated workspace W2 — shares nothing with W1
  v_w1 uuid;
  v_w2 uuid;
  v_skill_w1 uuid;
  v_mission_alice uuid; -- in W1, assigned to alice (not bob)
  v_mission_bob uuid;   -- in W1, assigned to bob
begin
  perform tests.create_user(v_alice, 'rls-alice@test.dev', 'Alice');
  perform tests.create_user(v_bob, 'rls-bob@test.dev', 'Bob');
  perform tests.create_user(v_carol, 'rls-carol@test.dev', 'Carol');

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'W1', false, v_alice) returning id into v_w1;
  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'W2', false, v_carol) returning id into v_w2;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_w1, v_alice, 'OWNER'), (v_w1, v_bob, 'MEMBER'), (v_w2, v_carol, 'OWNER');

  insert into public.skills (id, workspace_id, name)
  values (gen_random_uuid(), v_w1, 'Fitness') returning id into v_skill_w1;

  insert into public.missions
    (id, workspace_id, created_by, assigned_to, skill_id, title, difficulty, xp_reward, coin_reward)
  values (gen_random_uuid(), v_w1, v_alice, v_alice, v_skill_w1, 'Alice-only mission', 'EASY', 10, 1)
  returning id into v_mission_alice;

  insert into public.missions
    (id, workspace_id, created_by, assigned_to, skill_id, title, difficulty, xp_reward, coin_reward)
  values (gen_random_uuid(), v_w1, v_alice, v_bob, v_skill_w1, 'Bob mission', 'EASY', 10, 1)
  returning id into v_mission_bob;

  -- =====================================================================
  -- anon: zero access to any application table or RPC — the 0015 GRANTs
  -- never mention `anon`, so this is rejected before RLS is even
  -- evaluated.
  -- =====================================================================
  perform tests.login_as_anon();
  perform tests.assert_raises('select 1 from public.profiles limit 1', '42501', 'anon cannot select profiles');
  perform tests.assert_raises('select 1 from public.workspaces limit 1', '42501', 'anon cannot select workspaces');
  perform tests.assert_raises(
    format('select public.complete_mission(%L::uuid)', v_mission_alice),
    '42501', 'anon cannot execute complete_mission (no EXECUTE grant at all)'
  );
  perform tests.logout();

  -- =====================================================================
  -- Unauthorized workspace access: Carol (W2, no relationship to W1)
  -- cannot see ANY of W1's data, even though it exists.
  -- =====================================================================
  perform tests.login_as(v_carol);
  perform tests.assert_empty(format('select 1 from public.workspaces where id = %L', v_w1), 'carol cannot see W1');
  perform tests.assert_empty(format('select 1 from public.skills where workspace_id = %L', v_w1), 'carol cannot see W1 skills');
  perform tests.assert_empty(format('select 1 from public.missions where workspace_id = %L', v_w1), 'carol cannot see W1 missions');
  perform tests.assert_empty(
    format('select 1 from public.workspace_members where workspace_id = %L', v_w1),
    'carol cannot see W1 membership list'
  );

  -- Non-member cannot create data in a workspace she has no role in at all.
  perform tests.assert_raises(
    format(
      'insert into public.skills (workspace_id, name) values (%L, %L)',
      v_w1, 'Intrusion'
    ),
    '42501', 'carol cannot insert a skill into W1 (not a member)'
  );
  perform tests.logout();

  -- =====================================================================
  -- Cross-user access within the SAME workspace still respects mission
  -- visibility: Bob (MEMBER, not OWNER) sees his own assigned mission but
  -- not Alice's — spec section 31, "un miembro ve las misiones que le
  -- fueron asignadas, un OWNER ve todas las del workspace."
  -- =====================================================================
  perform tests.login_as(v_bob);
  perform tests.assert_empty(
    format('select 1 from public.missions where id = %L', v_mission_alice),
    'bob (MEMBER) cannot see a mission not assigned to him'
  );
  assert (select count(*) from public.missions where id = v_mission_bob) = 1,
    'bob must see his own assigned mission';

  -- MEMBER cannot manage the catalog (skills/areas are OWNER-only, spec
  -- section 4) even though he CAN read it.
  assert (select count(*) from public.skills where id = v_skill_w1) = 1,
    'bob (MEMBER) can still read the workspace catalog';
  perform tests.assert_raises(
    format('insert into public.skills (workspace_id, name) values (%L, %L)', v_w1, 'Cooking'),
    '42501', 'bob (MEMBER) cannot insert a skill (OWNER-only)'
  );
  -- An UPDATE whose USING clause excludes every row it would otherwise
  -- match doesn't raise (unlike a WITH CHECK failure on INSERT/UPDATE) — it
  -- silently affects zero rows, which is what RLS is actually documented
  -- to do for the write side's read-qualification. Assert on that instead
  -- of expecting an exception.
  update public.skills set name = 'Renamed' where id = v_skill_w1;
  assert (select name from public.skills where id = v_skill_w1) = 'Fitness',
    'bob (MEMBER) must not be able to rename a skill (OWNER-only) — the UPDATE should silently match 0 rows';

  -- A MEMBER cannot self-promote to OWNER — 0015 revokes ALL privileges on
  -- workspace_members from `authenticated` other than SELECT, so this is
  -- rejected before RLS is even reached (spec section 31, explicitly
  -- named: "un miembro no puede convertirse en OWNER").
  perform tests.assert_raises(
    format('update public.workspace_members set role = ''OWNER'' where workspace_id = %L and user_id = %L', v_w1, v_bob),
    '42501', 'bob cannot update his own workspace_members row at all'
  );

  -- Cross-user profile visibility: Bob CANNOT see Carol's profile (no
  -- shared workspace) even though profiles as a table is broadly
  -- SELECT-able — visibility is scoped by public.shares_workspace_with().
  perform tests.assert_empty(
    format('select 1 from public.profiles where id = %L', v_carol),
    'bob cannot see carol''s profile (no shared workspace)'
  );
  -- ...but CAN see Alice's (shared workspace W1).
  assert (select count(*) from public.profiles where id = v_alice) = 1,
    'bob can see alice''s profile (shared workspace W1)';
  perform tests.logout();

  -- =====================================================================
  -- Reverse check: Alice (OWNER) sees every mission in her workspace,
  -- including the one assigned to Bob, not just her own.
  -- =====================================================================
  perform tests.login_as(v_alice);
  assert (select count(*) from public.missions where workspace_id = v_w1) = 2,
    'alice (OWNER) must see both missions in W1, including the one assigned to bob';
  perform tests.logout();

  raise notice 'rls_test.sql: all assertions passed';
end;
$$;

rollback;
