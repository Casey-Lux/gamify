begin;

do $$
declare
  v_user   uuid := '00000000-0000-0000-0000-0000000000e1';
  v_other  uuid := '00000000-0000-0000-0000-0000000000e2';
  v_ws     uuid;
  v_skill  uuid;
  v_habit  uuid;
  v_old    uuid;
  v_row    record;
  v_count  integer;
  v_xp     integer;
  v_xp2    integer;
  v_target smallint;
  v_date   date;
begin
  perform tests.create_user(v_user, 'hw-user@test.dev', 'User');
  perform tests.create_user(v_other, 'hw-other@test.dev', 'Other');

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'HW Workspace', false, v_user) returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, v_user, 'OWNER'), (v_ws, v_other, 'MEMBER');
  insert into public.skills (id, workspace_id, name)
  values (gen_random_uuid(), v_ws, 'Fitness') returning id into v_skill;

  perform tests.login_as(v_user);

  insert into public.habits (workspace_id, user_id, skill_id, title, xp_reward, coin_reward, weekly_target, schedule_effective_from)
  values (v_ws, v_user, v_skill, 'Gimnasio', 10, 5, 3, current_date - 20)
  returning id into v_habit;

  select weekly_target into v_target from public.habit_schedule_history
  where habit_id = v_habit and effective_from = current_date - 20;
  assert v_target = 3, 'creation must record weekly_target in the schedule history';

  perform tests.assert_raises(
    format($f$insert into public.habits (workspace_id, user_id, skill_id, title, weekly_target) values (%L, %L, %L, 'x', 0)$f$, v_ws, v_user, v_skill),
    '23514', 'weekly_target = 0 rejected');
  perform tests.assert_raises(
    format($f$insert into public.habits (workspace_id, user_id, skill_id, title, weekly_target) values (%L, %L, %L, 'x', 8)$f$, v_ws, v_user, v_skill),
    '23514', 'weekly_target = 8 rejected');
  perform tests.assert_raises(
    format($f$insert into public.habits (workspace_id, user_id, skill_id, title, weekly_target, days_of_week) values (%L, %L, %L, 'x', 2, '{1,3}')$f$, v_ws, v_user, v_skill),
    '23514', 'weekly_target needs all seven days available');

  update public.habits set weekly_target = 5, schedule_effective_from = current_date - 10 where id = v_habit;
  select count(*) into v_count from public.habit_schedule_history where habit_id = v_habit;
  assert v_count = 2, 'weekly_target change must add a history row';
  select weekly_target into v_target from public.habit_schedule_history
  where habit_id = v_habit and effective_from = current_date - 20;
  assert v_target = 3, 'old weekly_target must be preserved';

  update public.habits
  set weekly_target = null, days_of_week = '{1,3}', schedule_effective_from = current_date - 5
  where id = v_habit;
  select count(*) into v_count from public.habit_schedule_history where habit_id = v_habit;
  assert v_count = 3, 'switching to weekdays must add a history row';
  select weekly_target into v_target from public.habit_schedule_history
  where habit_id = v_habit and effective_from = current_date - 5;
  assert v_target is null, 'weekday schedule has no weekly_target';

  update public.habits set reminder_time = '09:00' where id = v_habit;
  select count(*) into v_count from public.habit_schedule_history where habit_id = v_habit;
  assert v_count = 3, 'non-schedule edit must not touch history';

  select * into v_row from public.backfill_habit_completion(v_habit, current_date - 3);
  assert v_row.xp_awarded = 10 and v_row.coins_awarded = 5, 'backfill grants the normal rewards';
  select total_xp into v_xp from public.profiles where id = v_user;
  assert v_xp = 10, 'profile xp updated by backfill';
  select count(*) into v_count from public.mission_completions where user_id = v_user;
  assert v_count = 1, 'backfill writes the immutable completion row';
  select count(*) into v_count from public.wallet_transactions where user_id = v_user;
  assert v_count = 1, 'backfill writes the wallet transaction';
  select count(*) into v_count from public.missions
  where habit_id = v_habit and habit_date = current_date - 3 and status = 'DONE';
  assert v_count = 1, 'occurrence is DONE on the backfilled date';

  perform tests.assert_raises(
    format('select * from public.backfill_habit_completion(%L, current_date - 3)', v_habit),
    'GM004', 'same day twice rejected');
  select total_xp into v_xp2 from public.profiles where id = v_user;
  assert v_xp2 = 10, 'no double reward';

  perform tests.assert_raises(
    format('select * from public.backfill_habit_completion(%L, current_date - 25)', v_habit),
    'GM008', 'before the habit existed rejected');
  perform tests.assert_raises(
    format('select * from public.backfill_habit_completion(%L, current_date + 2)', v_habit),
    'GM008', 'future date rejected');
  perform tests.assert_raises(
    format('select * from public.backfill_habit_completion(%L, null)', v_habit),
    'GM008', 'null date rejected');

  insert into public.habits (workspace_id, user_id, skill_id, title, xp_reward, coin_reward, schedule_effective_from)
  values (v_ws, v_user, v_skill, 'Viejo', 1, 0, current_date - 90)
  returning id into v_old;
  perform tests.assert_raises(
    format('select * from public.backfill_habit_completion(%L, current_date - 31)', v_old),
    'GM008', 'older than 30 days rejected');
  perform public.backfill_habit_completion(v_old, current_date - 30);

  perform public.backfill_habit_completion(v_habit, current_date - 2);
  select total_xp into v_xp from public.profiles where id = v_user;

  perform public.move_habit_completion(v_habit, current_date - 2, current_date - 1);
  select count(*) into v_count from public.missions
  where habit_id = v_habit and habit_date = current_date - 2;
  assert v_count = 0, 'old date is free after the move';
  select count(*) into v_count from public.missions
  where habit_id = v_habit and habit_date = current_date - 1 and status = 'DONE';
  assert v_count = 1, 'completion now lives on the new date';
  select total_xp into v_xp2 from public.profiles where id = v_user;
  assert v_xp2 = v_xp, 'moving a completion changes no xp';

  perform tests.assert_raises(
    format('select * from public.complete_habit(%L, current_date - 1)', v_habit),
    'GM004', 'complete_habit sees backfilled/moved occurrence');

  perform tests.assert_raises(
    format('select public.move_habit_completion(%L, current_date - 1, current_date - 3)', v_habit),
    'GM004', 'cannot move onto a day that already has a completion');
  perform tests.assert_raises(
    format('select public.move_habit_completion(%L, current_date - 4, current_date - 5)', v_habit),
    'GM003', 'nothing to move on that date');
  perform tests.assert_raises(
    format('select public.move_habit_completion(%L, current_date - 1, current_date - 25)', v_habit),
    'GM008', 'cannot move before the habit existed');
  perform tests.assert_raises(
    format('select public.move_habit_completion(%L, current_date - 1, current_date - 1)', v_habit),
    'GM008', 'same date is not a move');

  perform tests.login_as(v_other);
  perform tests.assert_raises(
    format('select * from public.backfill_habit_completion(%L, current_date - 4)', v_habit),
    'GM002', 'cannot backfill someone else''s habit');
  perform tests.assert_raises(
    format('select public.move_habit_completion(%L, current_date - 1, current_date - 4)', v_habit),
    'GM002', 'cannot move someone else''s completion');

  perform tests.login_as(v_user);
  update public.habits set archived_at = now() where id = v_habit;
  perform tests.assert_raises(
    format('select * from public.backfill_habit_completion(%L, current_date - 4)', v_habit),
    'GM008', 'archived habit cannot be backfilled');
  perform tests.assert_raises(
    format('select public.move_habit_completion(%L, current_date - 1, current_date - 4)', v_habit),
    'GM008', 'archived habit cannot be edited');

  raise notice 'habit_weekly_history_test.sql: all assertions passed';
end;
$$;

rollback;
