export type DataDomain = 'missions' | 'habits' | 'statistics' | 'store';

const versions: Record<DataDomain, number> = { missions: 0, habits: 0, statistics: 0, store: 0 };

type Listener = (domains: readonly DataDomain[]) => void;
const listeners = new Set<Listener>();

export function versionOf(domain: DataDomain): number {
  return versions[domain];
}

export function invalidate(...domains: DataDomain[]): void {
  for (const domain of domains) versions[domain] += 1;
  for (const listener of listeners) listener(domains);
}

export function onInvalidate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
