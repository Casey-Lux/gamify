-- =============================================================================
-- 0019_workspace_membership_rpcs.sql
-- Fase 3 "Auth, profiles, workspaces, memberships"
-- spec section 4: OWNER "gestiona miembros"; section 31: "un miembro no puede
-- convertirse a OWNER mediante una operación cliente normal".
--
-- Documented secondary decision: adding a member happens by email lookup of
-- an existing, already-registered user (no invite-link/email-delivery system).
-- The spec does not describe an invite flow and explicitly asks to avoid
-- external email providers (section 51), so this is the simplest mechanism
-- that satisfies "OWNER gestiona miembros" without adding infrastructure.
-- If a real invite-by-email-link flow is wanted later, it is an additive
-- change (a new table + RPC), not a redesign of what exists here.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- create_workspace: creates the workspace row and its first OWNER membership
-- atomically, so a workspace can never exist without exactly one owner.
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(
  p_name text,
  p_is_personal boolean default false
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.workspaces;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'workspace name must not be blank' using errcode = '22023';
  end if;

  insert into public.workspaces (name, is_personal, created_by)
  values (trim(p_name), coalesce(p_is_personal, false), v_user_id)
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, v_user_id, 'OWNER');

  return v_workspace;
end;
$$;

comment on function public.create_workspace(text, boolean) is
  'Creates a workspace and makes the calling user its OWNER, atomically. '
  'p_is_personal=true is rejected if the user already has a personal '
  'workspace (enforced by workspaces_one_personal_per_creator_idx).';

-- ---------------------------------------------------------------------------
-- add_workspace_member: OWNER-only. Looks up an existing user by email
-- (auth.users is never exposed to the client directly) and adds them as
-- MEMBER. Cannot be used to add someone as OWNER — see spec section 31.
-- ---------------------------------------------------------------------------
create or replace function public.add_workspace_member(
  p_workspace_id uuid,
  p_email text
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_target_user_id uuid;
  v_member public.workspace_members;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = v_caller
      and role = 'OWNER'
  ) then
    raise exception 'only a workspace OWNER can add members' using errcode = '42501';
  end if;

  select id into v_target_user_id
  from auth.users
  where email = p_email;

  if v_target_user_id is null then
    raise exception 'no registered user found with email %', p_email
      using errcode = 'P0002';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, v_target_user_id, 'MEMBER')
  on conflict (workspace_id, user_id) do nothing
  returning * into v_member;

  if v_member.id is null then
    raise exception 'that user is already a member of this workspace'
      using errcode = '23505';
  end if;

  return v_member;
end;
$$;

comment on function public.add_workspace_member(uuid, text) is
  'OWNER-only. Adds an already-registered user as MEMBER by email. Never '
  'grants OWNER — role escalation only happens via update_workspace_member_role.';

-- ---------------------------------------------------------------------------
-- update_workspace_member_role: OWNER-only. Promote/demote, but a workspace
-- must always keep at least one OWNER.
-- ---------------------------------------------------------------------------
create or replace function public.update_workspace_member_role(
  p_workspace_id uuid,
  p_user_id uuid,
  p_new_role public.workspace_role
)
returns public.workspace_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_member public.workspace_members;
  v_owner_count integer;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = v_caller
      and role = 'OWNER'
  ) then
    raise exception 'only a workspace OWNER can change member roles' using errcode = '42501';
  end if;

  -- Lock the target row so two concurrent demotions of different owners
  -- can't both pass the "count > 1" check and leave zero owners behind.
  select * into v_member
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_member.id is null then
    raise exception 'user is not a member of this workspace' using errcode = 'P0002';
  end if;

  if v_member.role = 'OWNER' and p_new_role = 'MEMBER' then
    select count(*) into v_owner_count
    from public.workspace_members
    where workspace_id = p_workspace_id and role = 'OWNER';

    if v_owner_count <= 1 then
      raise exception 'cannot demote the last remaining OWNER of a workspace'
        using errcode = '23514';
    end if;
  end if;

  update public.workspace_members
  set role = p_new_role
  where workspace_id = p_workspace_id and user_id = p_user_id
  returning * into v_member;

  return v_member;
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_workspace_member: an OWNER may remove anyone; a MEMBER may remove
-- only themselves (leave workspace). A workspace must always keep at least
-- one OWNER.
-- ---------------------------------------------------------------------------
create or replace function public.remove_workspace_member(
  p_workspace_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_member public.workspace_members;
  v_owner_count integer;
begin
  if v_caller is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if v_caller <> p_user_id and not exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = v_caller
      and role = 'OWNER'
  ) then
    raise exception 'only a workspace OWNER can remove other members' using errcode = '42501';
  end if;

  select * into v_member
  from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  for update;

  if v_member.id is null then
    raise exception 'user is not a member of this workspace' using errcode = 'P0002';
  end if;

  if v_member.role = 'OWNER' then
    select count(*) into v_owner_count
    from public.workspace_members
    where workspace_id = p_workspace_id and role = 'OWNER';

    if v_owner_count <= 1 then
      raise exception 'cannot remove the last remaining OWNER of a workspace'
        using errcode = '23514';
    end if;
  end if;

  delete from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: authenticated may call these RPCs; nobody may call them as anon.
-- ---------------------------------------------------------------------------
revoke all on function public.create_workspace(text, boolean) from public;
revoke all on function public.add_workspace_member(uuid, text) from public;
revoke all on function public.update_workspace_member_role(uuid, uuid, public.workspace_role) from public;
revoke all on function public.remove_workspace_member(uuid, uuid) from public;

grant execute on function public.create_workspace(text, boolean) to authenticated;
grant execute on function public.add_workspace_member(uuid, text) to authenticated;
grant execute on function public.update_workspace_member_role(uuid, uuid, public.workspace_role) to authenticated;
grant execute on function public.remove_workspace_member(uuid, uuid) to authenticated;
