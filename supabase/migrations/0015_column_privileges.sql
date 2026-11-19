revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;

revoke all on public.workspaces from authenticated;
grant select on public.workspaces to authenticated;
grant update (name) on public.workspaces to authenticated;

revoke all on public.workspace_members from authenticated;
grant select on public.workspace_members to authenticated;

revoke all on public.skills from authenticated;
grant select, insert, update, delete on public.skills to authenticated;

revoke all on public.areas from authenticated;
grant select, insert, update, delete on public.areas to authenticated;

revoke all on public.player_skills from authenticated;
grant select on public.player_skills to authenticated;

revoke all on public.missions from authenticated;
grant select, insert, delete on public.missions to authenticated;
grant update (
  title, description, difficulty, xp_reward, coin_reward, due_at,
  area_id, assigned_to
) on public.missions to authenticated;

revoke all on public.mission_subtasks from authenticated;
grant select, insert, update, delete on public.mission_subtasks to authenticated;

revoke all on public.mission_completions from authenticated;
grant select on public.mission_completions to authenticated;

revoke all on public.wallet_transactions from authenticated;
grant select on public.wallet_transactions to authenticated;

revoke all on public.store_items from authenticated;
grant select, insert, delete on public.store_items to authenticated;
grant update (
  name, description, price, duration_minutes, effect_type, effect_value, active
) on public.store_items to authenticated;

revoke all on public.consumable_activations from authenticated;
grant select on public.consumable_activations to authenticated;

revoke all on public.purchases from authenticated;
grant select on public.purchases to authenticated;

revoke all on public.profiles, public.workspaces, public.workspace_members,
  public.skills, public.player_skills, public.areas, public.missions,
  public.mission_subtasks, public.mission_completions, public.wallet_transactions,
  public.store_items, public.consumable_activations, public.purchases
from anon;
