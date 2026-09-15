import { openDB } from "idb";
const DB_NAME = "gamify-cache";
const DB_VERSION = 1;
const STORE_NAMES = [
  "profile",
  "catalog",
  "missions",
  "statistics",
  "user-skills",
  "settings"
];
let dbPromise = null;
function getDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB no está disponible en este entorno."));
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
async function getCached(store, key) {
  try {
    const db = await getDb();
    const value = await db.get(store, key);
    return value ?? null;
  } catch {
    return null;
  }
}
async function setCached(store, key, data) {
  try {
    const db = await getDb();
    const entry = { data, cachedAt: (/* @__PURE__ */ new Date()).toISOString() };
    await db.put(store, entry, key);
  } catch {
  }
}
export {
  getCached as g,
  setCached as s
};
