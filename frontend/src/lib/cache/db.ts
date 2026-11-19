import { openDB, type IDBPDatabase } from 'idb';

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

export async function setCached<T>(store: CacheStoreName, key: string, data: T): Promise<void> {
  try {
    const db = await getDb();
    const entry: CachedEntry<T> = { data, cachedAt: new Date().toISOString() };
    await db.put(store, entry, key);
  } catch {
    return;
  }
}
