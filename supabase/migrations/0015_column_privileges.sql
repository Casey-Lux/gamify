-- =============================================================================
-- 0015_column_privileges.sql
-- spec section 5/6/9/11/12/14 ("el cliente jamás modifica directamente...")
--
-- Strategy: this is enforced at TWO independent layers, deliberately:
--   1) Table/column-level GRANT/REVOKE (this file) — the Postgres role used by
--      the `authenticated` client simply does not have the SQL privilege to
--      write these columns at all, regardless of RLS.
--   2) Row Level Security (0016_rls_policies.sql) — controls WHICH rows a role
--      may touch with the privileges it does have.
-- RPC functions introduced in later phases (Fase 5/6) are created as
-- SECURITY DEFINER, so they execute with their owning role's privileges
-- (which include full read/write on every column) regardless of what the
-- calling client role has been granted — that is how "only RPCs may change
-- xp/level/coins/stock/completed_at/etc." is actually enforced end-to-end.
-- =============================================================================

-- profiles: client may rename themselves / change avatar path only.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;
-- total_xp, level, coins: no client grant, ever.

-- workspaces: client may read and rename; creation/deletion go through RPCs
-- (see 0005_workspaces.sql comment) so membership stays consistent.
revoke all on public.workspaces from authenticated;
grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;

-- workspace_members: read-only for the client. Role changes/creation are
-- RPC-only, so a member can never self-promote to OWNER.
revoke all on public.workspace_members from authenticated;
grant select on public.workspace_members to authenticated;

-- skills / areas: OWNER-managed (enforced by RLS, section 4). Full DML grant
-- here; RLS in 0016 restricts it to workspace owners.
revoke all on public.skills from authenticated;
grant select, insert, update, delete on public.skills to authenticated;

revoke all on public.areas from authenticated;
grant select, insert, update, delete on public.areas to authenticated;

-- player_skills: entirely RPC-managed. Client only ever reads it.
revoke all on public.player_skills from authenticated;
grant select on public.player_skills to authenticated;

-- missions: client can create/delete/read; only non-economy, non-lifecycle
-- fields are directly updatable. completed_at, skill_id, workspace_id and
-- created_by can never be changed by a plain client UPDATE.
revoke all on public.missions from authenticated;
grant select, insert, delete on public.missions to authenticated;
grant update (
  title, description, difficulty, xp_reward, coin_reward, due_at,
  area_id, assigned_to
) on public.missions to authenticated;

-- mission_subtasks: fully client-manageable (checking items off is a plain
-- user action, not an economy operation — see 0008_mission_subtasks.sql).
revoke all on public.mission_subtasks from authenticated;
grant select, insert, update, delete on public.mission_subtasks to authenticated;

-- mission_completions: immutable history. Client only ever reads its own rows
-- (RLS-restricted); RPC-only insert, no update/delete for anyone but the
-- schema owner.
revoke all on public.mission_completions from authenticated;
grant select on public.mission_completions to authenticated;

-- wallet_transactions: immutable ledger, same pattern.
revoke all on public.wallet_transactions from authenticated;
grant select on public.wallet_transactions to authenticated;

-- store_items: OWNER-managed (section 4), but `stock` is excluded from the
-- client's UPDATE grant — it is a derived/managed counter, only ever written
-- by the purchase_item RPC (Fase 6) and by the column default on INSERT.
revoke all on public.store_items from authenticated;
grant select, insert, delete on public.store_items to authenticated;
grant update (
  name, description, price, duration_minutes, effect_type, effect_value, active
) on public.store_items to authenticated;

-- consumable_activations: immutable history, RPC-only insert.
revoke all on public.consumable_activations from authenticated;
grant select on public.consumable_activations to authenticated;

-- purchases: immutable history, RPC-only insert.
revoke all on public.purchases from authenticated;
grant select on public.purchases to authenticated;

-- The anon role gets nothing on any application table: every feature in this
-- spec requires an authenticated user.
revoke all on public.profiles, public.workspaces, public.workspace_members,
  public.skills, public.player_skills, public.areas, public.missions,
  public.mission_subtasks, public.mission_completions, public.wallet_transactions,
  public.store_items, public.consumable_activations, public.purchases
from anon;
