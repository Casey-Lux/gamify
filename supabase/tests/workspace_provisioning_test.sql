-- =============================================================================
-- supabase/tests/workspace_provisioning_test.sql
-- Fase 12 (extended) — regression test for a bug found while building the
-- mission/skill/area creation UI: a freshly registered user got a
-- public.profiles row (0018's original trigger) but NO workspace at all,
-- because create_workspace() (0019) was only ever meant to be called from
-- the frontend and nothing in the frontend ever called it. Every screen
-- that depends on an active workspace (Missions, Store, Statistics,
-- catalog) would stay permanently empty for a real new user. Fixed by
-- folding personal-workspace + OWNER-membership provisioning into the same
-- handle_new_user() trigger that already provisions the profile.
--
-- Requires _harness.sql and every migration already applied (see
-- run_db_tests.sh). Wrapped in BEGIN/ROLLBACK: leaves no data behind.
-- =============================================================================
begin;

do $$
declare
  v_user_named   uuid := '00000000-0000-0000-0000-0000000000f1';
  v_user_no_name uuid := '00000000-0000-0000-0000-0000000000f2';
  v_ws_count     integer;
  v_ws           record;
  v_member       record;
begin
  -- -------------------------------------------------------------------
  -- A user who signs up with a display_name gets exactly one personal
  -- workspace, named after it, and is its OWNER — all as a side effect of
  -- auth.users being inserted, same as their profile.
  -- -------------------------------------------------------------------
  perform tests.create_user(v_user_named, 'wp-named@test.dev', 'Nadia');

  select count(*) into v_ws_count
  from public.workspaces
  where created_by = v_user_named and is_personal;
  assert v_ws_count = 1,
    format('expected exactly 1 personal workspace for a new user, got %s', v_ws_count);

  select * into v_ws from public.workspaces where created_by = v_user_named and is_personal;
  assert v_ws.name = 'Nadia', format('expected workspace name ''Nadia'', got %L', v_ws.name);

  select * into v_member
  from public.workspace_members
  where workspace_id = v_ws.id and user_id = v_user_named;
  assert v_member.role = 'OWNER',
    format('expected the new user to be OWNER of their own personal workspace, got %L', v_member.role);

  -- -------------------------------------------------------------------
  -- A user who signs up with no display_name (email/password only, the
  -- real signUp() call the login page makes) still gets one, named after
  -- the same email-local-part fallback handle_new_user() already used for
  -- display_name — so both rows the trigger creates stay consistent with
  -- each other.
  -- -------------------------------------------------------------------
  perform tests.create_user(v_user_no_name, 'wp-no-name@test.dev', null);

  select * into v_ws from public.workspaces where created_by = v_user_no_name and is_personal;
  assert v_ws.name = 'wp-no-name',
    format('expected workspace name ''wp-no-name'' (email local-part fallback), got %L', v_ws.name);

  -- -------------------------------------------------------------------
  -- The one-personal-workspace-per-creator invariant (0017) still holds:
  -- a second personal workspace for the same user, via the same RPC a
  -- client would call, must still be rejected.
  -- -------------------------------------------------------------------
  perform tests.login_as(v_user_named);
  perform tests.assert_raises(
    format('select public.create_workspace(%L, true)', 'Second personal'),
    '23505',
    'a user must not be able to create a second personal workspace'
  );
  perform tests.logout();

  raise notice 'workspace_provisioning_test.sql: all assertions passed';
end;
$$;

rollback;
