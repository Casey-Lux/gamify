import { supabase } from '$lib/supabase/client';
import type { WalletTransaction } from '$lib/types/domain';
import type { CompletionWithContext, SkillProgress } from '$lib/types/statistics';

export class StatisticsApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'StatisticsApiError';
  }
}

interface CompletionRow {
  id: string;
  completed_at: string;
  xp_awarded: number;
  coins_awarded: number;
  skill_id: string;
  skill: { name: string } | null;
  mission: { area_id: string | null; area: { name: string } | null } | null;
}

/**
 * Spec section 35: "Utilizar mission_completions... como fuentes" — this
 * reads the immutable history table directly (RLS already restricts it to
 * the caller's own rows), joining in just the skill/area *names* needed to
 * label "actividad por skill"/"actividad por área". No aggregate table is
 * read or written.
 */
export async function fetchCompletions(sinceIso: string): Promise<CompletionWithContext[]> {
  const { data, error } = await supabase
    .from('mission_completions')
    .select(
      `
      id, completed_at, xp_awarded, coins_awarded, skill_id,
      skill:skills(name),
      mission:missions(area_id, area:areas(name))
      `
    )
    .gte('completed_at', sinceIso)
    .order('completed_at', { ascending: true });

  if (error) throw new StatisticsApiError(error.message, error.code);

  return ((data ?? []) as unknown as CompletionRow[]).map((row) => ({
    id: row.id,
    completed_at: row.completed_at,
    xp_awarded: row.xp_awarded,
    coins_awarded: row.coins_awarded,
    skill_id: row.skill_id,
    skill_name: row.skill?.name ?? 'Skill',
    area_id: row.mission?.area_id ?? null,
    area_name: row.mission?.area?.name ?? null
  }));
}

/** Spec section 35: "monedas ganadas / monedas gastadas" — both come from
 * the same immutable ledger (amount > 0 is income, amount < 0 is spend; see
 * 0010_wallet_transactions.sql), not from two separate tables. */
export async function fetchWalletTransactions(sinceIso: string): Promise<WalletTransaction[]> {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true });

  if (error) throw new StatisticsApiError(error.message, error.code);
  return (data ?? []) as WalletTransaction[];
}

interface PlayerSkillRow {
  skill_id: string;
  level: number;
  xp: number;
  skill: { name: string } | null;
}

/** Current per-skill level/XP for the radar chart — this is a snapshot of
 * the player's present standing (like the User Card), not a windowed
 * activity query, so it takes no date range. */
export async function fetchSkillProgress(): Promise<SkillProgress[]> {
  const { data, error } = await supabase
    .from('player_skills')
    .select('skill_id, level, xp, skill:skills(name)');

  if (error) throw new StatisticsApiError(error.message, error.code);

  return ((data ?? []) as unknown as PlayerSkillRow[]).map((row) => ({
    skill_id: row.skill_id,
    skill_name: row.skill?.name ?? 'Skill',
    level: row.level,
    xp: row.xp
  }));
}
