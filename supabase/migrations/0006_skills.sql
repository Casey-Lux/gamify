-- =============================================================================
-- 0006_skills.sql
-- spec section 6 "Skills" + section 7 "Niveles" (table shape only; the
-- calculate_level() function itself is introduced in Fase 4 per the spec's own
-- phase ordering, section 54).
-- =============================================================================

create table public.skills (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name         text not null,
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint skills_name_not_blank check (length(trim(name)) > 0),
  -- Documented secondary decision: unique skill name per workspace. Not
  -- explicitly required by the spec, but the simplest way to avoid confusing
  -- duplicate skills (e.g. two "Fitness" skills) in the same workspace's UI.
  constraint skills_unique_name_per_workspace unique (workspace_id, name)
);

create trigger skills_set_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

alter table public.skills enable row level security;

create table public.player_skills (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  skill_id   uuid not null references public.skills (id) on delete cascade,
  xp         integer not null default 0,
  level      integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint player_skills_unique unique (user_id, skill_id),
  constraint player_skills_xp_non_negative check (xp >= 0),
  constraint player_skills_level_positive check (level >= 1)
);

comment on table public.player_skills is
  'Per-user progress in a skill. xp/level are economy fields: entirely '
  'RPC-managed, no direct client INSERT/UPDATE (see 0015_column_privileges.sql). '
  'A row is created lazily (upsert) the first time a user completes a mission '
  'in that skill, by the complete_mission RPC (Fase 5).';

create trigger player_skills_set_updated_at
before update on public.player_skills
for each row execute function public.set_updated_at();

alter table public.player_skills enable row level security;
