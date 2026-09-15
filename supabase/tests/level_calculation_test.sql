-- =============================================================================
-- supabase/tests/level_calculation_test.sql
-- Fase 4 — "La fórmula debe: estar testeada"
--
-- Plain assertion-based SQL test (no external framework required, so it runs
-- anywhere psql does: locally, in CI, or against a preview branch). Every
-- assertion RAISEs on failure, so a clean run with no output past the final
-- NOTICE means every check passed.
--
-- Run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/level_calculation_test.sql
-- =============================================================================

do $$
declare
  v_level  integer;
  v_xp     integer;
  v_prev   integer;
  v_row    record;
begin
  -- 1. Level 1 costs exactly 0 XP (spec: "nivel 1 = 0 XP").
  assert public.xp_for_level(1) = 0, 'xp_for_level(1) must be 0';
  assert public.calculate_level(0) = 1, 'calculate_level(0) must be 1';

  -- 2. calculate_level is exact at thresholds: xp_for_level(N) is the first
  --    XP value that yields level N, and xp_for_level(N) - 1 must NOT yet.
  for v_level in 1..25 loop
    v_xp := public.xp_for_level(v_level);
    assert public.calculate_level(v_xp) = v_level,
      format('calculate_level(xp_for_level(%s)=%s) must equal %s, got %s',
             v_level, v_xp, v_level, public.calculate_level(v_xp));

    if v_level > 1 then
      assert public.calculate_level(v_xp - 1) = v_level - 1,
        format('calculate_level(xp_for_level(%s) - 1) must equal %s', v_level, v_level - 1);
    end if;
  end loop;

  -- 3. Monotonic: xp_for_level is strictly increasing.
  v_prev := public.xp_for_level(1);
  for v_level in 2..50 loop
    v_xp := public.xp_for_level(v_level);
    assert v_xp > v_prev,
      format('xp_for_level must strictly increase: level %s (%s) <= level %s (%s)',
             v_level, v_xp, v_level - 1, v_prev);
    v_prev := v_xp;
  end loop;

  -- 4. Each level step costs strictly more XP than the previous step (spec:
  --    "cada nivel posterior requiere más XP que el anterior").
  declare
    v_prev_cost integer;
    v_cost integer;
  begin
    v_prev_cost := public.xp_for_level(2) - public.xp_for_level(1);
    for v_level in 3..50 loop
      v_cost := public.xp_for_level(v_level) - public.xp_for_level(v_level - 1);
      assert v_cost > v_prev_cost,
        format('level step cost must increase: step to %s (%s) <= step to %s (%s)',
               v_level, v_cost, v_level - 1, v_prev_cost);
      v_prev_cost := v_cost;
    end loop;
  end;

  -- 5. calculate_level never decreases as XP increases (monotonic non-decreasing).
  declare
    v_prev_level integer := public.calculate_level(0);
  begin
    for v_xp in 0..5000 by 137 loop  -- odd step to hit non-boundary values too
      v_level := public.calculate_level(v_xp);
      assert v_level >= v_prev_level,
        format('calculate_level must be non-decreasing: xp=%s gave level %s after level %s',
               v_xp, v_level, v_prev_level);
      v_prev_level := v_level;
    end loop;
  end;

  -- 6. calculate_level_progress: internal consistency at an arbitrary
  --    mid-level XP value.
  select * into v_row from public.calculate_level_progress(350);
  assert v_row.level = public.calculate_level(350),
    'progress.level must match calculate_level(350)';
  assert v_row.xp_into_level = 350 - public.xp_for_level(v_row.level),
    'progress.xp_into_level must equal xp - threshold(level)';
  assert v_row.xp_for_next_level = public.xp_for_level(v_row.level + 1) - public.xp_for_level(v_row.level),
    'progress.xp_for_next_level must equal threshold(level+1) - threshold(level)';
  assert v_row.xp_needed_for_next_level = public.xp_for_level(v_row.level + 1) - 350,
    'progress.xp_needed_for_next_level must equal threshold(level+1) - xp';
  assert v_row.progress_percent >= 0 and v_row.progress_percent <= 100,
    format('progress_percent must be within [0, 100], got %s', v_row.progress_percent);

  -- 7. Progress is exactly 0%% right at a level threshold, and climbs toward
  --    (but never reaches) 100%% just before the next one.
  select * into v_row from public.calculate_level_progress(public.xp_for_level(4));
  assert v_row.progress_percent = 0,
    format('progress_percent must be 0 exactly at a level threshold, got %s', v_row.progress_percent);

  select * into v_row from public.calculate_level_progress(public.xp_for_level(5) - 1);
  assert v_row.progress_percent < 100,
    format('progress_percent must be < 100 one XP before leveling up, got %s', v_row.progress_percent);

  -- 8. Invalid input is rejected, not silently coerced.
  begin
    perform public.calculate_level(-1);
    raise exception 'calculate_level(-1) should have raised but did not';
  exception
    when sqlstate '22023' then
      null; -- expected
  end;

  begin
    perform public.xp_for_level(0);
    raise exception 'xp_for_level(0) should have raised but did not';
  exception
    when sqlstate '22023' then
      null; -- expected
  end;

  raise notice 'level_calculation_test.sql: all assertions passed';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. Trigger integration: profiles.level and player_skills.level must be
--    kept in sync automatically by 0021_level_sync_triggers.sql. Requires a
--    real profiles/skills/player_skills row, so this part is wrapped in a
--    transaction that is always rolled back — it never leaves test data
--    behind, and works whether or not the caller already has real data.
-- ---------------------------------------------------------------------------
begin;

  insert into auth.users (id, email)
  values ('00000000-0000-0000-0000-000000000001', 'level-test@example.com')
  on conflict (id) do nothing;

  insert into public.profiles (id, display_name, total_xp)
  values ('00000000-0000-0000-0000-000000000001', 'Level Test', 350)
  on conflict (id) do update set total_xp = excluded.total_xp;

  do $$
  declare
    v_level integer;
  begin
    select level into v_level from public.profiles
    where id = '00000000-0000-0000-0000-000000000001';

    assert v_level = public.calculate_level(350),
      format('profiles.level trigger out of sync: expected %s, got %s',
             public.calculate_level(350), v_level);

    raise notice 'level_calculation_test.sql: profiles.level trigger sync OK';
  end;
  $$;

rollback;
