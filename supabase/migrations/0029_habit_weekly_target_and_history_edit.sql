-- =============================================================================
-- 0029_habit_weekly_target_and_history_edit.sql
--
-- 1) Frecuencia "X veces por semana" (sin días concretos).
--    * habits.weekly_target (1..7) — null = frecuencia por días de la semana,
--      exactamente como hasta ahora. Con weekly_target los 7 días quedan
--      "disponibles" (days_of_week = {1..7}, lo exige un check) y es la app
--      quien decide, de forma derivada y reversible, qué días tocan.
--    * habit_schedule_history.weekly_target — mismo patrón append-only que los
--      días: cambiar la frecuencia nunca reescribe cómo se evaluó el pasado.
--    * El trigger que registra el calendario ahora también reacciona a
--      weekly_target (si no, pasar de "diario" a "3 por semana" no dejaría
--      rastro, porque days_of_week no cambia).
--
-- 2) Edición del historial de hábitos (olvidé registrarlo / sin conexión).
--    * backfill_habit_completion: registra un cumplimiento de un día pasado.
--      Es la MISMA economía que complete_habit (crea la ocurrencia y delega en
--      complete_mission): XP, monedas, efectos activos, niveles, wallet e
--      historial inmutable funcionan sin cambios. La recompensa se concede al
--      registrar (con los efectos activos en ese momento), nunca se reescribe
--      el pasado.
--    * move_habit_completion: corrige la FECHA de un cumplimiento ya
--      registrado. No toca la economía (no hay XP que revertir) y el índice
--      único (habit_id, habit_date) impide duplicados.
--    * complete_habit NO se modifica (sigue limitado a ±1 día).
--
--    Ventana editable: desde max(hoy - 30 días, primer día del hábito) hasta
--    hoy (+1 día de tolerancia de zona horaria, igual que complete_habit).
--    La constante 30 se repite en el frontend (HABIT_HISTORY_EDIT_DAYS).
--
-- Códigos de error: los mismos que complete_habit (GM001, GM002, GM003, GM004,
-- GM008), ver supabase/docs/error_codes.md.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) weekly_target
-- ---------------------------------------------------------------------------
alter table public.habits
  add column weekly_target smallint;

alter table public.habits
  add constraint habits_weekly_target_valid
    check (weekly_target is null or weekly_target between 1 and 7),
  add constraint habits_weekly_needs_all_days
    check (weekly_target is null or cardinality(days_of_week) = 7);

comment on column public.habits.weekly_target is
  'null = frecuencia por días (days_of_week). 1..7 = "X veces por semana" sin días concretos; days_of_week vale entonces {1..7}.';

alter table public.habit_schedule_history
  add column weekly_target smallint;

grant update (weekly_target) on public.habits to authenticated;

create or replace function public.habits_record_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.days_of_week = old.days_of_week
     and new.weekly_target is not distinct from old.weekly_target then
    return new;
  end if;

  -- Dos cambios el mismo día colapsan en uno (no ha transcurrido ningún día
  -- evaluable entre ellos, así que no se pierde información).
  insert into public.habit_schedule_history (habit_id, effective_from, days_of_week, weekly_target)
  values (new.id, new.schedule_effective_from, new.days_of_week, new.weekly_target)
  on conflict (habit_id, effective_from)
  do update set days_of_week = excluded.days_of_week,
                weekly_target = excluded.weekly_target;

  return new;
end;
$$;

drop trigger habits_after_write_schedule on public.habits;
create trigger habits_after_write_schedule
after insert or update of days_of_week, weekly_target on public.habits
for each row execute function public.habits_record_schedule();

-- ---------------------------------------------------------------------------
-- 2) Edición del historial
-- ---------------------------------------------------------------------------

-- Regla única de "qué fecha se puede editar" (la usan las dos RPCs).
create or replace function public.habit_date_is_editable(p_date date, p_first_day date)
returns boolean
language sql
stable
as $$
  select p_date is not null
     and p_date <= current_date + 1
     and p_date >= current_date - 30
     and (p_first_day is null or p_date >= p_first_day);
$$;

revoke all on function public.habit_date_is_editable(date, date) from public;

create or replace function public.backfill_habit_completion(p_habit_id uuid, p_date date)
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
#variable_conflict use_column
declare
  v_user_id    uuid := auth.uid();
  v_habit      public.habits;
  v_first_day  date;
  v_mission_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'GM001';
  end if;

  -- Misma serialización que complete_habit: un solo registro a la vez por hábito.
  select * into v_habit from public.habits where id = p_habit_id for update;

  if v_habit.id is null then
    raise exception 'habit not found' using errcode = 'GM003';
  end if;
  if v_habit.user_id <> v_user_id then
    raise exception 'not authorized to edit this habit' using errcode = 'GM002';
  end if;
  if v_habit.archived_at is not null then
    raise exception 'habit is archived' using errcode = 'GM008';
  end if;

  select min(effective_from) into v_first_day
  from public.habit_schedule_history where habit_id = p_habit_id;

  if not public.habit_date_is_editable(p_date, v_first_day) then
    raise exception 'date is outside the editable history window' using errcode = 'GM008';
  end if;

  if exists (
    select 1 from public.missions m
    where m.habit_id = p_habit_id and m.habit_date = p_date
  ) then
    raise exception 'habit already completed for this date' using errcode = 'GM004';
  end if;

  insert into public.missions (
    workspace_id, created_by, assigned_to, skill_id, area_id, title, description,
    difficulty, xp_reward, coin_reward, status, habit_id, habit_date
  )
  values (
    v_habit.workspace_id, v_user_id, v_user_id, v_habit.skill_id, v_habit.area_id,
    v_habit.title, v_habit.description, v_habit.difficulty, v_habit.xp_reward,
    v_habit.coin_reward, 'DOING', p_habit_id, p_date
  )
  returning id into v_mission_id;

  return query select * from public.complete_mission(v_mission_id);
end;
$$;

comment on function public.backfill_habit_completion(uuid, date) is
  'Registers a habit completion for a past day (inside the editable window) through the same economy as complete_habit.';

revoke all on function public.backfill_habit_completion(uuid, date) from public;
grant execute on function public.backfill_habit_completion(uuid, date) to authenticated;

create or replace function public.move_habit_completion(p_habit_id uuid, p_from date, p_to date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id    uuid := auth.uid();
  v_habit      public.habits;
  v_first_day  date;
  v_mission_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'GM001';
  end if;

  select * into v_habit from public.habits where id = p_habit_id for update;

  if v_habit.id is null then
    raise exception 'habit not found' using errcode = 'GM003';
  end if;
  if v_habit.user_id <> v_user_id then
    raise exception 'not authorized to edit this habit' using errcode = 'GM002';
  end if;
  if v_habit.archived_at is not null then
    raise exception 'habit is archived' using errcode = 'GM008';
  end if;

  select min(effective_from) into v_first_day
  from public.habit_schedule_history where habit_id = p_habit_id;

  if p_from is null or p_to is null or p_from = p_to
     or not public.habit_date_is_editable(p_from, v_first_day)
     or not public.habit_date_is_editable(p_to, v_first_day) then
    raise exception 'date is outside the editable history window' using errcode = 'GM008';
  end if;

  select m.id into v_mission_id
  from public.missions m
  where m.habit_id = p_habit_id and m.habit_date = p_from and m.completed_at is not null
  for update;

  if v_mission_id is null then
    raise exception 'no completion on that date' using errcode = 'GM003';
  end if;

  if exists (
    select 1 from public.missions m
    where m.habit_id = p_habit_id and m.habit_date = p_to
  ) then
    raise exception 'habit already completed for this date' using errcode = 'GM004';
  end if;

  -- Solo cambia la fecha de la ocurrencia: XP, monedas y wallet ya se
  -- contabilizaron y no se tocan. (missions_habit_occurrence_unique es la
  -- segunda barrera contra duplicados.)
  update public.missions set habit_date = p_to where id = v_mission_id;
end;
$$;

comment on function public.move_habit_completion(uuid, date, date) is
  'Moves the date of an already registered habit completion (no economy changes).';

revoke all on function public.move_habit_completion(uuid, date, date) from public;
grant execute on function public.move_habit_completion(uuid, date, date) to authenticated;
