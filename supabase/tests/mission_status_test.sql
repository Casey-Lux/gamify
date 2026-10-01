-- =============================================================================
-- supabase/tests/mission_status_test.sql
-- 0026_mission_status_due_time.sql: status (TODO/DOING/DONE) kept consistent
-- with completed_at, optional due time, edit/delete permissions.
-- Wrapped in BEGIN/ROLLBACK like the other test files.
-- =============================================================================
begin;

do $$
declare
  v_owner  uuid := '00000000-0000-0000-0000-0000000000c1';
  v_member uuid := '00000000-0000-0000-0000-0000000000c2';
  v_other  uuid := '00000000-0000-0000-0000-0000000000c3';
  v_ws     uuid;
  v_skill  uuid;
  v_m1     uuid;
  v_m2     uuid;
  v_status public.mission_status;
  v_has_time boolean;
  v_count  integer;
begin
  perform tests.create_user(v_owner, 'ms-owner@test.dev', 'Owner');
  perform tests.create_user(v_member, 'ms-member@test.dev', 'Member');
  perform tests.create_user(v_other, 'ms-other@test.dev', 'Other');

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'MS Workspace', false, v_owner) returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, v_owner, 'OWNER'), (v_ws, v_member, 'MEMBER');
  insert into public.skills (id, workspace_id, name)
  values (gen_random_uuid(), v_ws, 'Skill') returning id into v_skill;

  -- ---- member creates a mission (defaults: TODO, has_time true) ----------
  perform tests.login_as(v_member);
  insert into public.missions (workspace_id, created_by, assigned_to, skill_id, title, difficulty)
  values (v_ws, v_member, v_member, v_skill, 'm1', 'EASY') returning id into v_m1;
  select status, due_has_time into v_status, v_has_time from public.missions where id = v_m1;
  assert v_status = 'TODO', 'default status must be TODO';

  -- ---- date-only deadline ------------------------------------------------
  update public.missions set due_at = date_trunc('day', now()), due_has_time = false,
    status = 'DOING' where id = v_m1;
  select status, due_has_time into v_status, v_has_time from public.missions where id = v_m1;
  assert v_status = 'DOING' and v_has_time = false, 'status/date-only update must persist';

  -- due_has_time=false without a due date is rejected
  perform tests.assert_raises(
    format('update public.missions set due_at = null, due_has_time = false where id = %L', v_m1),
    '23514', 'date-only flag needs a due date');

  -- ---- a client can never mark DONE directly -----------------------------
  perform tests.assert_raises(
    format('update public.missions set status = ''DONE'' where id = %L', v_m1),
    'P0001', 'client cannot set DONE');
  perform tests.assert_raises(
    format($f$insert into public.missions (workspace_id, created_by, assigned_to, skill_id, title, difficulty, status) values (%L, %L, %L, %L, 'x', 'EASY', 'DONE')$f$,
      v_ws, v_member, v_member, v_skill),
    'P0001', 'client cannot insert DONE');

  -- ---- complete_mission flips status to DONE automatically ---------------
  perform public.complete_mission(v_m1);
  select status into v_status from public.missions where id = v_m1;
  assert v_status = 'DONE', 'complete_mission must leave the mission DONE';

  -- a DONE mission cannot be reopened or edited into another status
  perform tests.assert_raises(
    format('update public.missions set status = ''TODO'' where id = %L', v_m1),
    'P0001', 'DONE mission cannot change status');

  -- a completed mission cannot be deleted (history is RESTRICTed)
  perform tests.assert_raises(
    format('delete from public.missions where id = %L', v_m1),
    '23503', 'completed mission delete is refused');

  -- ---- delete permissions -------------------------------------------------
  insert into public.missions (workspace_id, created_by, assigned_to, skill_id, title, difficulty)
  values (v_ws, v_member, v_member, v_skill, 'm2', 'EASY') returning id into v_m2;

  -- an unrelated user in no workspace deletes nothing
  perform tests.login_as(v_other);
  delete from public.missions where id = v_m2;
  perform tests.logout();
  select count(*) into v_count from public.missions where id = v_m2;
  assert v_count = 1, 'outsider must not be able to delete';

  -- the creator can edit and delete
  perform tests.login_as(v_member);
  update public.missions set title = 'm2 edited' where id = v_m2;
  select count(*) into v_count from public.missions where id = v_m2 and title = 'm2 edited';
  assert v_count = 1, 'creator edit must persist';
  delete from public.missions where id = v_m2;
  select count(*) into v_count from public.missions where id = v_m2;
  assert v_count = 0, 'creator delete must persist';

  raise notice 'mission_status_test.sql: all assertions passed';
end;
$$;

rollback;
