/**
 * Hand-written domain types mirroring the Postgres schema in
 * supabase/migrations. These are the single source of truth for the shape of
 * data on the frontend; the generated Supabase types (see
 * `npm run gen:types`, once a real project exists) can replace/augment these
 * later without changing how the rest of the app consumes them.
 */

export type WorkspaceRole = 'OWNER' | 'MEMBER';
export type MissionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type EffectType = 'XP_MULTIPLIER' | 'COIN_MULTIPLIER' | 'XP_FLAT_BONUS' | 'COIN_FLAT_BONUS';
export type ActivationStatus = 'ACTIVE' | 'EXPIRED';
export type WalletTransactionType = 'MISSION_REWARD' | 'ITEM_PURCHASE' | 'ADMIN_ADJUSTMENT';

export interface Profile {
  id: string;
  display_name: string;
  avatar_path: string | null;
  total_xp: number;
  level: number;
  coins: number;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  is_personal: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerSkill {
  id: string;
  user_id: string;
  skill_id: string;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface Area {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Mission {
  id: string;
  workspace_id: string;
  created_by: string;
  assigned_to: string;
  skill_id: string;
  area_id: string | null;
  title: string;
  description: string | null;
  difficulty: MissionDifficulty;
  xp_reward: number;
  coin_reward: number;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Mission joined with the columns the Missions view needs to render a card. */
export interface MissionWithRelations extends Mission {
  skill: Pick<Skill, 'id' | 'name'> | null;
  area: Pick<Area, 'id' | 'name'> | null;
  subtasks: MissionSubtask[];
}

export interface MissionSubtask {
  id: string;
  mission_id: string;
  title: string;
  position: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionCompletion {
  id: string;
  mission_id: string;
  user_id: string;
  skill_id: string;
  base_xp: number;
  xp_multiplier: number;
  xp_flat_bonus: number;
  xp_awarded: number;
  base_coins: number;
  coin_multiplier: number;
  coin_flat_bonus: number;
  coins_awarded: number;
  completed_at: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: WalletTransactionType;
  source_type: string;
  source_id: string | null;
  created_at: string;
}

export interface StoreItem {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  max_stock: number;
  effect_type: EffectType;
  effect_value: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsumableActivation {
  id: string;
  user_id: string;
  item_id: string;
  effect_type: EffectType;
  effect_value: number;
  activated_at: string;
  expires_at: string;
  status: ActivationStatus;
}

/** Return row of the `complete_mission(p_mission_id uuid)` RPC. */
export interface CompleteMissionResult {
  mission_id: string;
  completed_at: string;
  base_xp: number;
  xp_multiplier: number;
  xp_flat_bonus: number;
  xp_awarded: number;
  base_coins: number;
  coin_multiplier: number;
  coin_flat_bonus: number;
  coins_awarded: number;
  player_total_xp: number;
  player_level: number;
  player_leveled_up: boolean;
  player_coins: number;
  skill_id: string;
  skill_xp: number;
  skill_level: number;
  skill_leveled_up: boolean;
}

/** Return row of the `purchase_item(p_item_id uuid)` RPC. */
export interface PurchaseItemResult {
  item_id: string;
  item_name: string;
  price_paid: number;
  new_coin_balance: number;
  new_stock: number;
  new_price: number;
  activation_id: string;
  effect_type: EffectType;
  effect_value: number;
  activated_at: string;
  expires_at: string;
}
export interface LevelProgress {
  level: number;
  xp_into_level: number;
  xp_for_next_level: number;
  xp_needed_for_next_level: number;
  progress_percent: number;
}
