-- =============================================================================
-- 0027_habits.sql
-- Hábitos = misiones recurrentes.
--
-- Diseño (cambio mínimo, reutiliza la economía existente):
--   * `habits` guarda la CONFIGURACIÓN (título, frecuencia, recordatorio...).
--   * Cada vez que el usuario cumple un hábito en un día, `complete_habit`
--     crea una misión "ocurrencia" (missions.habit_id + habit_date) y llama a
--     la RPC existente `complete_mission`. Así XP, monedas, efectos activos,
--     niveles, skills, wallet_transactions y mission_completions (historial
--     inmutable usado por las estadísticas) funcionan SIN cambios.
--   * Solo existen misiones para ocurrencias CUMPLIDAS: los días no cumplidos
--     se derivan (días programados - ocurrencias), por lo que no hace falta
--     ningún job nocturno.
--   * `habit_schedule_history` es un registro append-only del calendario
--     (días de la semana + fecha de entrada en vigor). Cambiar la frecuencia
--     de un hábito nunca reescribe cómo se evaluaba el pasado.
--   * Los hábitos no se borran (se archivan): el historial debe conservarse.
-- =============================================================================

create table public.habits (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete restrict,
  skill_id      uuid not null references public.skills (id) on delete restrict,
  area_id       uuid references public.areas (id) on delete set null,
  title         text not null,
  description   text,
  difficulty    public.mission_difficulty not null default 'EASY',
  xp_reward     integer not null default 0,
  coin_reward   integer not null default 0,
  -- ISO weekday numbers: 1 = lunes ... 7 = domingo. "Diario" = los 7 días.
  days_of_week  smallint[] not null default '{1,2,3,4,5,6,7}',
  -- Fecha local (del usuario) desde la que rige days_of_week actual.
  schedule_effective_from date not null default current_date,
  -- Planificación dentro del plan diario.
  day_part      text not null default 'ANYTIME',
  -- Hora local del recordatorio; null = sin recordatorio.
  reminder_time time,
  -- Si true, la app puede relajar días con un patrón claro de incumplimiento
  -- (derivado en el cliente; nunca modifica days_of_week ni el historial).
  adaptive      boolean not null default true,
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint habits_title_not_blank check (length(trim(title)) > 0),
  constraint habits_xp_non_negative check (xp_reward >= 0),
  constraint habits_coins_non_negative check (coin_reward >= 0),
  constraint habits_days_valid check (
    cardinality(days_of_week) between 1 and 7
    and days_of_week <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  constraint habits_day_part_valid check (day_part in ('ANYTIME', 'MORNING', 'AFTERNOON', 'EVENING'))
);

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

create index habits_user_idx on public.habits (user_id) where archived_at is null;

-- Normaliza days_of_week (sin duplicados, ordenado) y valida que skill/área
-- pertenezcan al workspace y el usuario sea miembro (misma regla que missions).
create or replace function public.habits_validate()
returns trigger
language plpgsql
as $$
declare
  v_ws uuid;
begin
  new.days_of_week := array(
    select distinct d from unnest(new.days_of_week) as d order by d
  )::smallint[];

  select workspace_id into v_ws from public.skills where id = new.skill_id;
  if v_ws is null or v_ws <> new.workspace_id then
    raise exception 'habit.skill_id must belong to the same workspace as the habit';
  end if;

  if new.area_id is not null then
    select workspace_id into v_ws from public.areas where id = new.area_id;
    if v_ws is null or v_ws <> new.workspace_id then
      raise exception 'habit.area_id must belong to the same workspace as the habit';
    end if;
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = new.workspace_id and user_id = new.user_id
  ) then
    raise exception 'habit.user_id must be a member of the habit workspace';
  end if;

  return new;
end;
$$;

create trigger habits_before_write_validate
before insert or update on public.habits
for each row execute function public.habits_validate();

-- ---------------------------------------------------------------------------
-- Historial de calendario (append-only desde el punto de vista del cliente).
-- ---------------------------------------------------------------------------
create table public.habit_schedule_history (
  habit_id       uuid not null references public.habits (id) on delete cascade,
  effective_from date not null,
  days_of_week   smallint[] not null,
  created_at     timestamptz not null default now(),
  primary key (habit_id, effective_from)
);

create or replace function public.habits_record_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.days_of_week = old.days_of_week then
    return new;
  end if;

  -- Dos cambios el mismo día colapsan en uno (no ha transcurrido ningún día
  -- evaluable entre ellos, así que no se pierde información).
  insert into public.habit_schedule_history (habit_id, effective_from, days_of_week)
  values (new.id, new.schedule_effective_from, new.days_of_week)
  on conflict (habit_id, effective_from)
  do update set days_of_week = excluded.days_of_week;

  return new;
end;
$$;

create trigger habits_after_write_schedule
after insert or update of days_of_week on public.habits
for each row execute function public.habits_record_schedule();

-- ---------------------------------------------------------------------------
-- RLS + privilegios (mismo patrón que 0015/0016)
-- ---------------------------------------------------------------------------
alter table public.habits enable row level security;
alter table public.habit_schedule_history enable row level security;

revoke all on public.habits from authenticated, anon;
grant select, insert on public.habits to authenticated;
-- skill_id / workspace_id / user_id no son editables tras la creación.
grant update (
  title, description, difficulty, xp_reward, coin_reward, area_id,
  days_of_week, schedule_effective_from, day_part, reminder_time, adaptive, archived_at
) on public.habits to authenticated;

revoke all on public.habit_schedule_history from authenticated, anon;
grant select on public.habit_schedule_history to authenticated;

create policy habits_select_self on public.habits
  for select to authenticated
  using (user_id = auth.uid());

create policy habits_insert_self on public.habits
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy habits_update_self on public.habits
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy habit_schedule_history_select_self on public.habit_schedule_history
  for select to authenticated
  using (exists (
    select 1 from public.habits h
    where h.id = habit_schedule_history.habit_id and h.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- missions: columnas de ocurrencia de hábito
-- ---------------------------------------------------------------------------
alter table public.missions
  add column habit_id   uuid references public.habits (id) on delete restrict,
  add column habit_date date,
  add constraint missions_habit_columns_together
    check ((habit_id is null) = (habit_date is null));

-- Un hábito solo puede tener una ocurrencia por día.
create unique index missions_habit_occurrence_unique
  on public.missions (habit_id, habit_date) where habit_id is not null;

comment on column public.missions.habit_id is
  'Set only by complete_habit: this mission is the completed occurrence of a habit on habit_date.';

-- 0015 concede INSERT a nivel de tabla, así que las columnas nuevas serían
-- insertables por el cliente. Este guard (sin tocar los grants existentes)
-- garantiza que solo complete_habit (SECURITY DEFINER) crea ocurrencias.
create or replace function public.missions_guard_habit_columns()
returns trigger
language plpgsql
as $$
begin
  if new.habit_id is not null and current_user in ('authenticated', 'anon') then
    raise exception 'habit occurrences can only be created through complete_habit'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger missions_guard_habit_columns_trg
before insert on public.missions
for each row execute function public.missions_guard_habit_columns();

-- ---------------------------------------------------------------------------
-- complete_habit: crea la ocurrencia y delega TODA la economía en
-- complete_mission (sin duplicar su lógica). Atómica: una sola llamada.
-- Errores: GM001 sin sesión, GM002 no es tu hábito, GM003 no existe,
--          GM004 ya cumplido ese día, GM008 archivado / fecha no válida.
-- ---------------------------------------------------------------------------
create or replace function public.complete_habit(p_habit_id uuid, p_date date)
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
  v_mission_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'GM001';
  end if;

  -- Bloquea el hábito: serializa llamadas concurrentes para el mismo hábito.
  select * into v_habit from public.habits where id = p_habit_id for update;

  if v_habit.id is null then
    raise exception 'habit not found' using errcode = 'GM003';
  end if;
  if v_habit.user_id <> v_user_id then
    raise exception 'not authorized to complete this habit' using errcode = 'GM002';
  end if;
  if v_habit.archived_at is not null then
    raise exception 'habit is archived' using errcode = 'GM008';
  end if;
  -- La fecha es la local del usuario; el servidor solo tolera ±1 día de
  -- desfase de zona horaria respecto a su propia fecha.
  if p_date is null or abs(p_date - current_date) > 1 then
    raise exception 'invalid habit date' using errcode = 'GM008';
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

comment on function public.complete_habit(uuid, date) is
  'Completes a habit for a day by creating its occurrence mission and delegating to complete_mission.';

revoke all on function public.complete_habit(uuid, date) from public;
grant execute on function public.complete_habit(uuid, date) to authenticated;
