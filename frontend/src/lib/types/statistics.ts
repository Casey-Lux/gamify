/**
 * Spec section 35: statistics are computed directly from the existing
 * historical tables (mission_completions, wallet_transactions) — no
 * aggregate/materialized tables are introduced. These types describe the
 * shapes this file's queries join together, not new tables.
 */

export type StatGranularity = 'day' | 'week' | 'month';

/** One completion, enriched with the skill/area names needed to group by
 * them (mission_completions itself only stores skill_id; area lives on the
 * mission it completed, so that's a join). */
export interface CompletionWithContext {
  id: string;
  completed_at: string;
  xp_awarded: number;
  coins_awarded: number;
  skill_id: string;
  skill_name: string;
  area_id: string | null;
  area_name: string | null;
}

export interface SkillProgress {
  skill_id: string;
  skill_name: string;
  level: number;
  xp: number;
}

/** A fixed time bucket used to group rows for the "por día/semana/mes"
 * charts. See src/lib/utils/date-buckets.ts for how these are generated. */
export interface StatBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}
