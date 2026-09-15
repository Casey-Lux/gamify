-- =============================================================================
-- 0005_workspaces.sql
-- spec section 4 "Workspace / organización"
-- =============================================================================
-- Design note (documented secondary decision): ownership is modeled purely
-- through workspace_members.role = 'OWNER', not a duplicate workspaces.owner_id
-- column. A single source of truth for "who owns what" avoids the two values
-- ever disagreeing. A workspace can have more than one OWNER over time (e.g.
-- ownership transfer), which the model supports for free.

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  is_personal boolean not null default false,
  created_by  uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint workspaces_name_not_blank check (length(trim(name)) > 0)
);

comment on table public.workspaces is
  'A workspace is either a personal space (is_personal = true) or an '
  'organization. Same schema for both, per spec: "evolve without redesign".';

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;

create table public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.workspace_role not null default 'MEMBER',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint workspace_members_unique unique (workspace_id, user_id)
);

comment on table public.workspace_members is
  'Membership + role. INSERT/UPDATE/DELETE are never granted to the client '
  'directly (see 0015_column_privileges.sql): a member could otherwise '
  'self-promote to OWNER, which spec section 31 explicitly forbids. '
  'Membership rows are created/managed by SECURITY DEFINER RPCs (Fase 3+).';

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

alter table public.workspace_members enable row level security;
