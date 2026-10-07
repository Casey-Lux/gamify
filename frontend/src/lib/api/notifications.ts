import { supabase } from '$lib/supabase/client';
import { fetchActiveEffects } from '$lib/api/store';
import type { BonusCompletion, DueMission } from '$lib/utils/notifications-derive';

export class NotificationApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'NotificationApiError';
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Deadlines further away than this are not "próximas"; overdue items older
 * than OVERDUE_LOOKBACK_DAYS are no longer surfaced as notifications. */
const UPCOMING_DAYS = 2;
const OVERDUE_LOOKBACK_DAYS = 30;
const BONUS_LOOKBACK_DAYS = 3;

/** The caller's pending missions with a deadline near/over. Habit
 * occurrences are excluded (they only exist once completed). */
export async function fetchDueMissions(userId: string, now: number): Promise<DueMission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('id, title, due_at, due_has_time')
    .eq('assigned_to', userId)
    .is('completed_at', null)
    .is('habit_id', null)
    .not('due_at', 'is', null)
    .gte('due_at', new Date(now - OVERDUE_LOOKBACK_DAYS * DAY_MS).toISOString())
    .lt('due_at', new Date(now + UPCOMING_DAYS * DAY_MS).toISOString())
    .order('due_at', { ascending: true })
    .limit(50);
  if (error) throw new NotificationApiError(error.message, error.code);
  return (data ?? []) as DueMission[];
}

interface BonusRow {
  id: string;
  completed_at: string;
  xp_multiplier: number;
  xp_flat_bonus: number;
  coin_multiplier: number;
  coin_flat_bonus: number;
  xp_awarded: number;
  coins_awarded: number;
  mission: { title: string } | null;
}

/** Recent completions where a multiplier or flat bonus was actually applied. */
export async function fetchBonusCompletions(now: number): Promise<BonusCompletion[]> {
  const { data, error } = await supabase
    .from('mission_completions')
    .select(
      'id, completed_at, xp_multiplier, xp_flat_bonus, coin_multiplier, coin_flat_bonus, xp_awarded, coins_awarded, mission:missions(title)'
    )
    .gte('completed_at', new Date(now - BONUS_LOOKBACK_DAYS * DAY_MS).toISOString())
    .or('xp_multiplier.gt.1,coin_multiplier.gt.1,xp_flat_bonus.gt.0,coin_flat_bonus.gt.0')
    .order('completed_at', { ascending: false })
    .limit(30);
  if (error) throw new NotificationApiError(error.message, error.code);
  return ((data ?? []) as unknown as BonusRow[]).map((r) => ({
    id: r.id,
    completed_at: r.completed_at,
    mission_title: r.mission?.title ?? 'misión',
    xp_multiplier: r.xp_multiplier,
    xp_flat_bonus: r.xp_flat_bonus,
    coin_multiplier: r.coin_multiplier,
    coin_flat_bonus: r.coin_flat_bonus,
    xp_awarded: r.xp_awarded,
    coins_awarded: r.coins_awarded
  }));
}

export const fetchActiveBonusEffects = fetchActiveEffects;

export async function fetchReadKeys(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('notification_reads')
    .select('notification_key')
    .order('read_at', { ascending: false })
    .limit(1000);
  if (error) throw new NotificationApiError(error.message, error.code);
  return new Set((data ?? []).map((r) => (r as { notification_key: string }).notification_key));
}

export async function markNotificationsRead(userId: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const { error } = await supabase.from('notification_reads').upsert(
    keys.map((notification_key) => ({ user_id: userId, notification_key })),
    { onConflict: 'user_id,notification_key', ignoreDuplicates: true }
  );
  if (error) throw new NotificationApiError(error.message, error.code);
}
