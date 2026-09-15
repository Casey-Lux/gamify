import { openDB, type IDBPDatabase } from 'idb';

/**
 * Spec section 27 ("Caché"): IndexedDB is used *only* as a local cache for
 * five kinds of data — perfil, skills, misiones recientes, configuración,
 * estadísticas recientes — never as a source of truth. PostgreSQL (via
 * Supabase) is always the authority; every store that reads/writes here also
 * always tries the network first (see the individual stores in
 * `$lib/stores/*`, which are the only callers of this module).
 *
 * Store items / tienda are deliberately NOT cached here: prices, stock and
 * the user's coin balance change on every purchase and a purchase can only
 * ever be resolved against the live server (spec section 18 — the RPC is
 * the only place that may decide a purchase), so a locally cached store
 * listing would be actively misleading rather than merely stale. Caching it
 * would also be a feature nobody asked for (spec section 2: "No implementar
 * funcionalidades no solicitadas.").
 *
 * One IndexedDB database, one object store per data kind, keyed by whatever
 * makes each kind unique (see the `key` parameter used by each store) so
 * that, for example, catalog data from two different workspaces or a
 * missions query under different filters can coexist without overwriting
 * each other.
 */

const DB_NAME = 'gamify-cache';
const DB_VERSION = 1;

const STORE_NAMES = [
  'profile',
  'catalog',
  'missions',
  'statistics',
  'user-skills',
  'settings'
] as const;

export type CacheStoreName = (typeof STORE_NAMES)[number];

export interface CachedEntry<T> {
  data: T;
  /**
   * ISO timestamp taken from the *client* clock, purely so the UI can show
   * "datos guardados hace N minutos" (spec section 27: "dejando claro
   * cuándo los datos pueden estar desactualizados"). This value is never
   * used to decide whether anything is valid/expired/rewardable — that
   * authority stays exclusively with Postgres' NOW() (spec section 33).
   */
  cachedAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB no está disponible en este entorno.'));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of STORE_NAMES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Reads a cached entry. Resolves to `null` on a cache miss *and* on any
 * failure to open/read IndexedDB (private browsing, disabled storage, quota
 * errors, unsupported browser…) — caching is always best-effort and must
 * never throw or block the caller; the calling store simply treats a `null`
 * the same as "no cached data available yet".
 */
export async function getCached<T>(
  store: CacheStoreName,
  key: string
): Promise<CachedEntry<T> | null> {
  try {
    const db = await getDb();
    const value = (await db.get(store, key)) as CachedEntry<T> | undefined;
    return value ?? null;
  } catch {
    return null;
  }
}

/**
 * Writes a cache entry, stamping it with the current time. Failures are
 * swallowed for the same reason as `getCached` — losing the ability to
 * cache must never break the (already-succeeded) network operation that
 * triggered the write.
 */
export async function setCached<T>(store: CacheStoreName, key: string, data: T): Promise<void> {
  try {
    const db = await getDb();
    const entry: CachedEntry<T> = { data, cachedAt: new Date().toISOString() };
    await db.put(store, entry, key);
  } catch {
    // Best-effort — see comment above.
  }
}
