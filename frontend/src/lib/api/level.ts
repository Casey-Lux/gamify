import { supabase } from '$lib/supabase/client';
import type { LevelProgress } from '$lib/types/domain';

/**
 * Spec section 7: "La fórmula debe estar centralizada... no duplicarse."
 * The frontend NEVER reimplements xp_for_level/calculate_level in
 * TypeScript — it always asks Postgres via this RPC, which is the single
 * point where the formula could later be tuned (0020_level_calculation.sql).
 */
export async function fetchLevelProgress(totalXp: number): Promise<LevelProgress> {
  const { data, error } = await supabase.rpc('calculate_level_progress', {
    p_total_xp: totalXp
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as LevelProgress;
}
