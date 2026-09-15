-- =============================================================================
-- 0007_areas_missions.sql
-- spec section 8 "Áreas" + section 9 "Misiones"
-- =============================================================================

create table public.areas (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint areas_name_not_blank check (length(trim(name)) > 0),
  -- Same reasoning as skills_unique_name_per_workspace above.
  constraint areas_unique_name_per_workspace unique (workspace_id, name)
);

create trigger areas_set_updated_at
before update on public.areas
for each row execute function public.set_updated_at();

alter table public.areas enable row level security;

create table public.missions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by   uuid not null references public.profiles (id) on delete restrict,
  assigned_to  uuid not null references public.profiles (id) on delete restrict,
  skill_id     uuid not null references public.skills (id) on delete restrict,
  area_id      uuid references public.areas (id) on delete set null,
  title        text not null,
  description  text,
  difficulty   public.mission_difficulty not null,
  xp_reward    integer not null default 0,
  coin_reward  integer not null default 0,
  due_at       timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint missions_title_not_blank check (length(trim(title)) > 0),
  constraint missions_xp_reward_non_negative check (xp_reward >= 0),
  constraint missions_coin_reward_non_negative check (coin_reward >= 0)
);

comment on table public.missions is
  'skill_id is NOT NULL and ON DELETE RESTRICT: a mission can never exist '
  'without a skill, and a skill in use cannot be deleted out from under it '
  '(spec: "una misión no puede existir sin skill"). area_id is optional '
  '(ON DELETE SET NULL). completed_at is only ever set by the complete_mission '
  'RPC (Fase 5), never directly by the client — see 0015_column_privileges.sql.';

create trigger missions_set_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

-- Cross-table integrity that a plain CHECK constraint cannot express: a
-- mission's skill/area/assignee must belong to the mission's own workspace.
-- This directly satisfies the "required workspace ownership" constraint listed
-- in spec section 45.
create or replace function public.missions_validate_workspace_consistency()
returns trigger
language plpgsql
as $$
declare
  v_skill_workspace uuid;
  v_area_workspace  uuid;
begin
  select workspace_id into v_skill_workspace
  from public.skills
  where id = new.skill_id;

  if v_skill_workspace is null or v_skill_workspace <> new.workspace_id then
    raise exception 'mission.skill_id must belong to the same workspace as the mission';
  end if;

  if new.area_id is not null then
    select workspace_id into v_area_workspace
    from public.areas
    where id = new.area_id;

    if v_area_workspace is null or v_area_workspace <> new.workspace_id then
      raise exception 'mission.area_id must belong to the same workspace as the mission';
    end if;
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = new.workspace_id
      and user_id = new.assigned_to
  ) then
    raise exception 'mission.assigned_to must be a member of the mission workspace';
  end if;

  return new;
end;
$$;

create trigger missions_before_write_consistency
before insert or update of workspace_id, skill_id, area_id, assigned_to
on public.missions
for each row execute function public.missions_validate_workspace_consistency();

alter table public.missions enable row level security;
