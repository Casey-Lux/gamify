/**
 * Tiny invalidation bus that replaces "reload everything when the user comes
 * back to the app".
 *
 * Data already loaded stays in memory while the user switches tabs, leaves
 * the window or moves between views. It is only refetched when something
 * actually changed it: every successful mutation in `$lib/api/*` calls
 * `invalidate(...)` for the domains it touches, and each store re-queries the
 * next time its data is needed (or immediately, when it is being displayed).
 * The database stays the source of truth: the RPCs / RLS / constraints
 * validate every action when it happens (this file never decides anything).
 *
 * No imports on purpose: both the API layer and the stores can use it
 * without creating import cycles.
 */
export type DataDomain = 'missions' | 'habits' | 'statistics' | 'store';

const versions: Record<DataDomain, number> = { missions: 0, habits: 0, statistics: 0, store: 0 };

type Listener = (domains: readonly DataDomain[]) => void;
const listeners = new Set<Listener>();

/** Monotonic counter: changes whenever `domain` is invalidated. */
export function versionOf(domain: DataDomain): number {
  return versions[domain];
}

export function invalidate(...domains: DataDomain[]): void {
  for (const domain of domains) versions[domain] += 1;
  for (const listener of listeners) listener(domains);
}

/** Subscribes to invalidations (used by the notifications store). */
export function onInvalidate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
