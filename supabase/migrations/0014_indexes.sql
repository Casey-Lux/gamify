-- =============================================================================
-- 0014_indexes.sql
-- spec section 46 "Índices" — indexes for real, spec-described query patterns.
-- No speculative/unused indexes are created.
-- =============================================================================

-- --- Explicitly listed in spec section 46 -----------------------------------
create index missions_workspace_id_idx on public.missions (workspace_id);
create index missions_assigned_to_idx on public.missions (assigned_to);
create index missions_skill_id_idx on public.missions (skill_id);
create index missions_area_id_idx on public.missions (area_id);
create index missions_difficulty_idx on public.missions (difficulty);
create index missions_due_at_idx on public.missions (due_at);

create index mission_completions_user_completed_idx
  on public.mission_completions (user_id, completed_at);

create index player_skills_user_id_idx on public.player_skills (user_id);

create index wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at);

create index purchases_user_created_idx on public.purchases (user_id, created_at);

create index consumable_activations_user_expires_idx
  on public.consumable_activations (user_id, expires_at);

-- --- Additional indexes, justified by real access patterns from other -----
-- --- sections of the spec (RLS membership checks run on every request; -----
-- --- subtask-completeness is checked on every mission render). -------------

-- workspace_members is queried by user_id on essentially every RLS check via
-- is_workspace_member()/is_workspace_owner() (section 31); without this index
-- every such check is a sequential scan.
create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);

-- The Missions UI must show "all subtasks complete?" for every visible
-- mission (section 10/23); this is looked up by mission_id constantly.
create index mission_subtasks_mission_id_idx on public.mission_subtasks (mission_id);

-- Skills/areas/store_items are always listed scoped to a workspace.
create index skills_workspace_id_idx on public.skills (workspace_id);
create index areas_workspace_id_idx on public.areas (workspace_id);
create index store_items_workspace_id_idx on public.store_items (workspace_id);
