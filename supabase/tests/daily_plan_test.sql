begin;

do $$
declare
  v_member  uuid := '00000000-0000-0000-0000-0000000000f1';
  v_owner   uuid := '00000000-0000-0000-0000-0000000000f2';
  v_outsider uuid := '00000000-0000-0000-0000-0000000000f3';
  v_ws      uuid;
  v_skill   uuid;
  v_mission uuid;
  v_plan    uuid;
  v_count   integer;
begin
  perform tests.create_user(v_member, 'dp-member@test.dev', 'Member');
  perform tests.create_user(v_owner, 'dp-owner@test.dev', 'Owner');
  perform tests.create_user(v_outsider, 'dp-outsider@test.dev', 'Outsider');

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'Daily Plan Workspace', false, v_owner) returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, v_owner, 'OWNER'), (v_ws, v_member, 'MEMBER');
  insert into public.skills (id, workspace_id, name)
  values (gen_random_uuid(), v_ws, 'Skill') returning id into v_skill;

  perform tests.login_as(v_member);
  insert into public.missions (workspace_id, created_by, assigned_to, skill_id, title, difficulty)
  values (v_ws, v_member, v_member, v_skill, 'planned mission', 'EASY')
  returning id into v_mission;
  update public.missions set status = 'DOING' where id = v_mission;

  insert into public.daily_plan_settings (user_id, monday_hours)
  values (v_member, 2);
  update public.daily_plan_settings set monday_hours = 4 where user_id = v_member;
  select count(*) into v_count
  from public.daily_plan_settings
  where user_id = v_member and monday_hours = 4;
  assert v_count = 1, 'member must read and update own settings';

  insert into public.daily_plans (user_id, workspace_id, plan_date, hours, slots)
  values (v_member, v_ws, current_date, 4, 2)
  returning id into v_plan;

  insert into public.daily_plan_missions (plan_id, mission_id, position)
  values (v_plan, v_mission, 1);

  select count(*) into v_count
  from public.daily_plan_missions
  where plan_id = v_plan;
  assert v_count = 1, 'member must read own plan missions';

  perform tests.assert_raises(
    format('insert into public.daily_plan_settings (user_id, monday_hours) values (%L, 2)', v_owner),
    '42501', 'member cannot write another user settings');

  perform tests.login_as(v_owner);
  select count(*) into v_count from public.daily_plan_settings where user_id = v_member;
  assert v_count = 0, 'owner cannot read another user settings';
  select count(*) into v_count from public.daily_plans where id = v_plan;
  assert v_count = 0, 'owner cannot read another user plan';

  perform tests.assert_raises(
    format($f$insert into public.daily_plans (user_id, workspace_id, plan_date, hours, slots) values (%L, %L, current_date, 2, 1)$f$, v_member, v_ws),
    '42501', 'owner cannot create a plan for another user');
  perform tests.assert_raises(
    format('insert into public.daily_plan_missions (plan_id, mission_id, position) values (%L, %L, 2)', v_plan, v_mission),
    '42501', 'owner cannot write another user plan missions');

  delete from public.daily_plans where id = v_plan;
  perform tests.logout();
  select count(*) into v_count from public.daily_plans where id = v_plan;
  assert v_count = 1, 'another user cannot delete the plan';

  perform tests.login_as(v_outsider);
  perform tests.assert_raises(
    format($f$insert into public.daily_plans (user_id, workspace_id, plan_date, hours, slots) values (%L, %L, current_date, 2, 1)$f$, v_outsider, v_ws),
    '42501', 'non-member cannot create a plan in the workspace');

  perform tests.logout();
  raise notice 'daily_plan_test.sql: all assertions passed';
end;
$$;

rollback;
