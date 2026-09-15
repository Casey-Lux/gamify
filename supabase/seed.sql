-- =============================================================================
-- seed.sql
-- spec section 48 "Seed"
--
-- Dev-only data: a test user, one personal workspace, a couple of skills and
-- areas, a handful of missions (some with subtasks, some without, one with
-- no due date, one already completed with a matching history row), and a
-- couple of store items. NOT required for production (spec: "Los datos de
-- seed no deben ser necesarios para producción.") — a production Supabase
-- project can apply the migrations and start from an empty schema; users are
-- provisioned normally via sign-up (0018_auth_profile_provisioning.sql).
--
-- This file talks directly to the tables (not through the client-facing RPCs
-- like create_workspace/complete_mission), because it runs as the Postgres
-- owner role outside of any authenticated request — there is no auth.uid()
-- for the RPCs' "identificar auth.uid()" step to read. Bypassing RLS this
-- way is fine here specifically because seed.sql is a trusted, local-only,
-- non-production script.
--
-- Usage: `supabase db reset` (applies migrations, then this file), or
-- `psql "$DATABASE_URL" -f supabase/seed.sql` against a dev database that
-- already has the migrations applied and a minimal `auth.users` table
-- available (spec's own caveat: "usuario de pruebas si el entorno local lo
-- permite" — this requires local Supabase / a stand-in `auth` schema, and is
-- skipped harmlessly if `auth.users` doesn't exist).
-- =============================================================================

do $$
declare
  v_user_id      uuid := '00000000-0000-0000-0000-000000000001';
  v_workspace_id uuid;
  v_skill_fitness uuid;
  v_skill_study   uuid;
  v_area_home     uuid;
  v_area_school   uuid;
  v_mission_run   uuid;
  v_mission_read  uuid;
  v_mission_clean uuid;
  v_mission_done  uuid;
begin
  -- -------------------------------------------------------------------------
  -- Test user. Only attempted if an `auth.users` table exists (local
  -- Supabase dev stack) — a bare Postgres without the `auth` schema simply
  -- skips this block, so the rest of the seed becomes a no-op too (every
  -- other row here references this user).
  -- -------------------------------------------------------------------------
  if to_regclass('auth.users') is null then
    raise notice 'auth.users not found — skipping seed (not a Supabase/local dev database)';
    return;
  end if;

  if not exists (select 1 from auth.users where id = v_user_id) then
    insert into auth.users (id, email, raw_user_meta_data, encrypted_password, email_confirmed_at)
    values (
      v_user_id,
      'demo@gamify.local',
      jsonb_build_object('display_name', 'Demo Player'),
      crypt('gamify-demo-password', gen_salt('bf')),
      now()
    );
    -- The on_auth_user_created trigger (0018) provisions public.profiles.
  end if;

  -- -------------------------------------------------------------------------
  -- Personal workspace. As of 0018_auth_profile_provisioning.sql, the
  -- on_auth_user_created trigger already creates this (named after the
  -- user's display_name, so "Demo Player" here) atomically with the
  -- auth.users insert above — this block only exists as a defensive
  -- fallback (e.g. re-running this file against a database from before
  -- that fix), not because it normally does anything.
  -- -------------------------------------------------------------------------
  select id into v_workspace_id from public.workspaces where created_by = v_user_id and is_personal;

  if v_workspace_id is null then
    insert into public.workspaces (name, is_personal, created_by)
    values ('Demo Player — Personal', true, v_user_id)
    returning id into v_workspace_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_workspace_id, v_user_id, 'OWNER');
  end if;

  -- -------------------------------------------------------------------------
  -- Skills + areas
  -- -------------------------------------------------------------------------
  insert into public.skills (workspace_id, name, description)
  values
    (v_workspace_id, 'Fitness', 'Ejercicio y salud física'),
    (v_workspace_id, 'Estudio', 'Aprendizaje y desarrollo intelectual')
  on conflict (workspace_id, name) do nothing;

  select id into v_skill_fitness from public.skills where workspace_id = v_workspace_id and name = 'Fitness';
  select id into v_skill_study from public.skills where workspace_id = v_workspace_id and name = 'Estudio';

  insert into public.areas (workspace_id, name)
  values
    (v_workspace_id, 'Casa'),
    (v_workspace_id, 'Escuela')
  on conflict (workspace_id, name) do nothing;

  select id into v_area_home from public.areas where workspace_id = v_workspace_id and name = 'Casa';
  select id into v_area_school from public.areas where workspace_id = v_workspace_id and name = 'Escuela';

  -- -------------------------------------------------------------------------
  -- Missions: one with a due date + subtasks, one without a due date, one
  -- without an area, and one already completed (with a matching
  -- mission_completions + wallet_transactions row, and profile/skill totals
  -- reflecting it — this is what "ejemplos de historial" in spec section 48
  -- calls for).
  -- -------------------------------------------------------------------------
  if not exists (
    select 1 from public.missions where workspace_id = v_workspace_id and title = 'Salir a correr 5km'
  ) then
    insert into public.missions (
      workspace_id, created_by, assigned_to, skill_id, area_id, title, description,
      difficulty, xp_reward, coin_reward, due_at
    )
    values (
      v_workspace_id, v_user_id, v_user_id, v_skill_fitness, v_area_home,
      'Salir a correr 5km', 'Ruta del parque, ritmo cómodo.',
      'MEDIUM', 50, 10, now() + interval '3 days'
    )
    returning id into v_mission_run;

    insert into public.mission_subtasks (mission_id, title, position)
    values
      (v_mission_run, 'Preparar ropa y zapatillas', 0),
      (v_mission_run, 'Calentar 5 minutos', 1),
      (v_mission_run, 'Correr los 5km', 2);
  end if;

  if not exists (
    select 1 from public.missions where workspace_id = v_workspace_id and title = 'Leer un capítulo del libro'
  ) then
    insert into public.missions (
      workspace_id, created_by, assigned_to, skill_id, area_id, title, description,
      difficulty, xp_reward, coin_reward, due_at
    )
    values (
      v_workspace_id, v_user_id, v_user_id, v_skill_study, v_area_school,
      'Leer un capítulo del libro', null,
      'EASY', 20, 5, null -- sin fecha límite
    )
    returning id into v_mission_read;
  end if;

  if not exists (
    select 1 from public.missions where workspace_id = v_workspace_id and title = 'Ordenar el cuarto'
  ) then
    insert into public.missions (
      workspace_id, created_by, assigned_to, skill_id, area_id, title, description,
      difficulty, xp_reward, coin_reward, due_at
    )
    values (
      v_workspace_id, v_user_id, v_user_id, v_skill_fitness, null,
      'Ordenar el cuarto', null,
      'HARD', 80, 15, now() - interval '1 day' -- vencida, sigue completable
    )
    returning id into v_mission_clean;
  end if;

  -- Already-completed example mission + its history rows.
  select id into v_mission_done
  from public.missions
  where workspace_id = v_workspace_id and title = 'Repasar apuntes de la semana';

  if v_mission_done is null then
    insert into public.missions (
      workspace_id, created_by, assigned_to, skill_id, area_id, title, description,
      difficulty, xp_reward, coin_reward, due_at, completed_at
    )
    values (
      v_workspace_id, v_user_id, v_user_id, v_skill_study, v_area_school,
      'Repasar apuntes de la semana', null,
      'EASY', 30, 5, null, now() - interval '2 days'
    )
    returning id into v_mission_done;
  end if;

  if not exists (select 1 from public.mission_completions where mission_id = v_mission_done) then
    insert into public.mission_completions (
      mission_id, user_id, skill_id, base_xp, xp_multiplier, xp_awarded,
      base_coins, coin_multiplier, coins_awarded, completed_at
    )
    values (
      v_mission_done, v_user_id, v_skill_study, 30, 1.00, 30, 5, 1.00, 5,
      now() - interval '2 days'
    );

    insert into public.wallet_transactions (user_id, amount, transaction_type, source_type, source_id)
    values (v_user_id, 5, 'MISSION_REWARD', 'mission_completion', v_mission_done);

    update public.profiles
    set total_xp = total_xp + 30, coins = coins + 5
    where id = v_user_id;
    -- profiles.level is recalculated automatically by the Fase 4 trigger
    -- (0021_level_sync_triggers.sql) on this UPDATE.

    insert into public.player_skills (user_id, skill_id, xp)
    values (v_user_id, v_skill_study, 30)
    on conflict (user_id, skill_id) do update set xp = public.player_skills.xp + excluded.xp;
    -- player_skills.level is likewise auto-recalculated by the same trigger.
  end if;

  -- -------------------------------------------------------------------------
  -- Store items (spec section 14): stock/price start at their defaults
  -- (5 / as given); purchase_item (Fase 6) is the only thing that ever moves
  -- them from here on.
  -- -------------------------------------------------------------------------
  if not exists (select 1 from public.store_items where workspace_id = v_workspace_id) then
    insert into public.store_items (
      workspace_id, name, description, price, effect_type, effect_value, duration_minutes
    )
    values
      (v_workspace_id, 'Poción de XP x1.25', 'Multiplica la próxima XP ganada durante 15 minutos.',
       20, 'XP_MULTIPLIER', 1.25, 15),
      (v_workspace_id, 'Poción de monedas x1.5', 'Multiplica las monedas ganadas durante 10 minutos.',
       25, 'COIN_MULTIPLIER', 1.50, 10),
      (v_workspace_id, 'Bono de +10 XP', 'Suma 10 XP planos a la próxima misión completada.',
       15, 'XP_FLAT_BONUS', 10, 5);
  end if;

  raise notice 'Seed complete for workspace %', v_workspace_id;
end;
$$;
