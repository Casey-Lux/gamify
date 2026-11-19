import { supabase } from '$lib/supabase/client';
import type { LevelProgress } from '$lib/types/domain';

export async function fetchLevelProgress(totalXp: number): Promise<LevelProgress> {
  const { data, error } = await supabase.rpc('calculate_level_progress', {
    p_total_xp: totalXp
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as LevelProgress;
}
