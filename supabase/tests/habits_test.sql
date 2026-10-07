-- =============================================================================
-- supabase/tests/habits_test.sql
-- 0027_habits.sql / 0028_notification_reads.sql: hábitos, historial de
-- calendario, complete_habit (reutiliza complete_mission), guard de columnas
-- de ocurrencia, RLS y notification_reads.
-- =============================================================================
begin;

do $$
declare
  v_user   uuid := '00000000-0000-0000-0000-0000000000d1';
  v_other  uuid := '00000000-0000-0000-0000-0000000000d2';
  v_ws     uuid;
  v_skill  uuid;
  v_habit  uuid;
  v_row    record;
  v_count  integer;
  v_days   smallint[];
  v_xp     integer;
begin
  perform tests.create_user(v_user, 'hb-user@test.dev', 'User');
  perform tests.create_user(v_other, 'hb-other@test.dev', 'Other');

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'HB Workspace', false, v_user) returning id into v_ws;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, v_user, 'OWNER'), (v_ws, v_other, 'MEMBER');
  insert into public.skills (id, workspace_id, name)
  values (gen_random_uuid(), v_ws, 'Fitness') returning id into v_skill;

  -- ---- create: daily by default, history row recorded --------------------
  perform tests.login_as(v_user);
  insert into public.habits (workspace_id, user_id, skill_id, title, difficulty, xp_reward, coin_reward)
  values (v_ws, v_user, v_skill, 'Correr', 'EASY', 10, 5) returning id into v_habit;

  select days_of_week into v_days from public.habits where id = v_habit;
  assert v_days = array[1,2,3,4,5,6,7]::smallint[], 'default must be daily';
  select count(*) into v_count from public.habit_schedule_history where habit_id = v_habit;
  assert v_count = 1, 'creation must record the first schedule';

  perform tests.assert_raises(
    format($f$insert into public.habits (workspace_id, user_id, skill_id, title, days_of_week) values (%L, %L, %L, 'x', '{}')$f$, v_ws, v_user, v_skill),
    '23514', 'empty days rejected');
  perform tests.assert_raises(
    format($f$insert into public.habits (workspace_id, user_id, skill_id, title, days_of_week) values (%L, %L, %L, 'x', '{8}')$f$, v_ws, v_user, v_skill),
    '23514', 'invalid weekday rejected');

  -- ---- schedule change appends history, never rewrites it -----------------
  update public.habits
  set days_of_week = '{3,1,1}', schedule_effective_from = current_date + 7
  where id = v_habit;
  select days_of_week into v_days from public.habits where id = v_habit;
  assert v_days = array[1,3]::smallint[], 'days normalized (sorted, distinct)';
  select count(*) into v_count from public.habit_schedule_history where habit_id = v_habit;
  assert v_count = 2, 'schedule change must add a history row';
  select days_of_week into v_days from public.habit_schedule_history
  where habit_id = v_habit and effective_from = current_date;
  assert v_days = array[1,2,3,4,5,6,7]::smallint[], 'old schedule must be preserved';

  -- config edits that are not schedule changes add nothing
  update public.habits set reminder_time = '08:30', day_part = 'MORNING' where id = v_habit;
  select count(*) into v_count from public.habit_schedule_history where habit_id = v_habit;
  assert v_count = 2, 'non-schedule edit must not touch history';

  -- skill cannot change; clients cannot delete
  perform tests.assert_raises(
    format('update public.habits set skill_id = %L where id = %L', v_skill, v_habit),
    '42501', 'skill_id not updatable');
  perform tests.assert_raises(
    format('delete from public.habits where id = %L', v_habit),
    '42501', 'habits cannot be deleted by clients');

  -- ---- complete_habit: economy goes through complete_mission --------------
  select * into v_row from public.complete_habit(v_habit, current_date);
  assert v_row.xp_awarded = 10 and v_row.coins_awarded = 5, 'rewards granted';
  select total_xp into v_xp from public.profiles where id = v_user;
  assert v_xp = 10, 'profile xp updated';
  select count(*) into v_count from public.mission_completions where user_id = v_user;
  assert v_count = 1, 'completion history row written';
  select count(*) into v_count from public.missions
  where habit_id = v_habit and habit_date = current_date and status = 'DONE';
  assert v_count = 1, 'occurrence mission is DONE';

  -- same day twice -> GM004, no double reward
  perform tests.assert_raises(
    format('select * from public.complete_habit(%L, current_date)', v_habit),
    'GM004', 'duplicate occurrence rejected');
  -- another day works
  perform public.complete_habit(v_habit, current_date - 1);
  -- too far away is rejected
  perform tests.assert_raises(
    format('select * from public.complete_habit(%L, current_date - 5)', v_habit),
    'GM008', 'date out of range rejected');

  -- ---- clients cannot forge occurrences ----------------------------------
  perform tests.assert_raises(
    format($f$insert into public.missions (workspace_id, created_by, assigned_to, skill_id, title, difficulty, habit_id, habit_date) values (%L, %L, %L, %L, 'fake', 'EASY', %L, current_date + 1)$f$,
      v_ws, v_user, v_user, v_skill, v_habit),
    '42501', 'client cannot create habit occurrences');

  -- ---- isolation ----------------------------------------------------------
  perform tests.login_as(v_other);
  select count(*) into v_count from public.habits;
  assert v_count = 0, 'other user must not see the habit';
  select count(*) into v_count from public.habit_schedule_history;
  assert v_count = 0, 'other user must not see the schedule history';
  perform tests.assert_raises(
    format('select * from public.complete_habit(%L, current_date)', v_habit),
    'GM002', 'cannot complete someone else''s habit');

  -- ---- archived habits cannot be completed --------------------------------
  perform tests.login_as(v_user);
  update public.habits set archived_at = now() where id = v_habit;
  perform tests.assert_raises(
    format('select * from public.complete_habit(%L, current_date + 1)', v_habit),
    'GM008', 'archived habit rejected');

  -- ---- notification_reads -------------------------------------------------
  insert into public.notification_reads (user_id, notification_key) values (v_user, 'k1');
  perform tests.assert_raises(
    format($f$insert into public.notification_reads (user_id, notification_key) values (%L, 'k2')$f$, v_other),
    '42501', 'cannot mark reads for another user');
  perform tests.login_as(v_other);
  select count(*) into v_count from public.notification_reads;
  assert v_count = 0, 'reads are private';

  raise notice 'habits_test.sql: all assertions passed';
end;
$$;

rollback;
