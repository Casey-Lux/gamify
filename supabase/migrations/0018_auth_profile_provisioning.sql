-- =============================================================================
-- 0018_auth_profile_provisioning.sql
-- Fase 3 "Auth, profiles, workspaces, memberships"
-- spec section 5 + criterio de aceptación "obtiene automáticamente un perfil"
-- =============================================================================
-- SECURITY DEFINER so it can INSERT into public.profiles regardless of the
-- (deliberately very restrictive, see 0015_column_privileges.sql) privileges
-- granted to ordinary client roles — it runs as the function's owner, which
-- has full table-owner rights and bypasses RLS.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
  v_workspace public.workspaces;
begin
  v_display_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  if v_display_name is null and new.email is not null then
    v_display_name := split_part(new.email, '@', 1);
  end if;

  if v_display_name is null then
    v_display_name := 'Player';
  end if;

  insert into public.profiles (id, display_name)
  values (new.id, v_display_name)
  on conflict (id) do nothing;

  -- Spec section 4: "Un usuario puede tener un workspace personal" — every
  -- newly registered user gets exactly one, automatically, the same way
  -- they automatically get a profile. This was originally left for the
  -- client to request via create_workspace() (0019), but nothing in the
  -- frontend ever called it: a freshly registered user would authenticate
  -- successfully yet have zero workspace_members rows, and every screen
  -- that depends on an active workspace (Missions, Store, Statistics,
  -- catalog) would stay permanently empty with no path to recover short of
  -- an admin manually inserting rows. Folding it into this same
  -- SECURITY DEFINER trigger — instead of a second round-trip from the
  -- client after signUp() — makes "has a personal workspace" as
  -- unconditionally true as "has a profile" already was, and keeps both
  -- provisioned atomically in the same transaction as the auth.users row
  -- itself. create_workspace() (0019) remains available and unchanged for
  -- creating *additional* (organization) workspaces later.
  insert into public.workspaces (name, is_personal, created_by)
  values (v_display_name, true, new.id)
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, new.id, 'OWNER');

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Auto-provisions a public.profiles row, a personal public.workspaces row, '
  'and its OWNER public.workspace_members row for every new auth.users row, '
  'all in one transaction. display_name defaults to the raw_user_meta_data.'
  'display_name passed at signup (SvelteKit signUp call), falling back to '
  'the email local-part, falling back to a generic placeholder. '
  'total_xp/level/coins use their table defaults (0/1/0) per spec section 5. '
  'The personal workspace reuses that same display_name — spec section 4 '
  'requires the workspace to exist, not any particular name for it, and the '
  'MVP has no workspace-rename UI, so this is the simplest default that is '
  'still recognizably "yours" rather than a generic placeholder.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
