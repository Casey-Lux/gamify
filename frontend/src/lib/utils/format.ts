import type { EffectType, MissionDifficulty } from '$lib/types/domain';

export const EFFECT_TYPE_LABEL: Record<EffectType, string> = {
  XP_MULTIPLIER: 'Multiplicador de XP',
  COIN_MULTIPLIER: 'Multiplicador de monedas',
  XP_FLAT_BONUS: 'Bono fijo de XP',
  COIN_FLAT_BONUS: 'Bono fijo de monedas'
};

/** Human-readable value for an effect, e.g. "×1.25" or "+10". */
export function formatEffectValue(effectType: EffectType, effectValue: number): string {
  const isMultiplier = effectType === 'XP_MULTIPLIER' || effectType === 'COIN_MULTIPLIER';
  return isMultiplier ? `×${effectValue}` : `+${effectValue}`;
}

/** "3:45" style countdown. Clamped to 0:00 once expired, never negative. */
export function formatRemaining(expiresAt: string, now: number = Date.now()): string {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Media',
  HARD: 'Difícil'
};

export const DIFFICULTY_ORDER: Record<MissionDifficulty, number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2
};

export function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return 'Sin fecha límite';
  const date = new Date(dueAt);
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Whether a mission's due date has passed. A mission without due_at is never overdue. */
export function isOverdue(dueAt: string | null, completedAt: string | null): boolean {
  if (!dueAt || completedAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}

/**
 * "hace menos de un minuto" / "hace 5 minutos" / "hace 3 horas" style
 * relative label, used exclusively by `CachedNotice.svelte` (Fase 11, spec
 * section 27) to tell the user how old the IndexedDB-cached data they are
 * looking at is. Display-only — never used to decide whether cached data is
 * "too old to show"; the cache always shows whatever it has, however old.
 */
export function formatCacheAge(cachedAtIso: string, now: number = Date.now()): string {
  const ageMs = Math.max(0, now - new Date(cachedAtIso).getTime());
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'hace menos de un minuto';
  if (minutes < 60) return `hace ${minutes} minuto${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} hora${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `hace ${days} día${days === 1 ? '' : 's'}`;
}
