import { writable, get } from 'svelte/store';
import {
  fetchStoreItems,
  fetchActiveEffects,
  purchaseItem as purchaseItemApi,
  describePurchaseError
} from '$lib/api/store';
import type { ConsumableActivation, StoreItem } from '$lib/types/domain';
import { versionOf } from '$lib/utils/freshness';

export interface StoreState {
  items: StoreItem[];
  activeEffects: ConsumableActivation[];
  loading: boolean;
  error: string | null;
  purchasingId: string | null;
  purchaseError: string | null;
}

const initialState: StoreState = {
  items: [],
  activeEffects: [],
  loading: false,
  error: null,
  purchasingId: null,
  purchaseError: null
};

function createStoreStore() {
  const { subscribe, update, set } = writable<StoreState>(initialState);

  let loadedFor: { workspaceId: string; version: number } | null = null;

  async function load(workspaceId: string) {
    const version = versionOf('store');
    update((s) => ({ ...s, loading: true, error: null }));
    try {
      const [items, activeEffects] = await Promise.all([
        fetchStoreItems(workspaceId),
        fetchActiveEffects()
      ]);
      update((s) => ({ ...s, items, activeEffects, loading: false }));
      loadedFor = { workspaceId, version };
    } catch {
      update((s) => ({ ...s, loading: false, error: 'No se pudo cargar la tienda.' }));
    }
  }

  function ensureLoaded(workspaceId: string) {
    if (loadedFor?.workspaceId !== workspaceId || loadedFor.version !== versionOf('store')) {
      return load(workspaceId);
    }
    return Promise.resolve();
  }

  async function purchase(itemId: string, workspaceId: string) {
    update((s) => ({ ...s, purchasingId: itemId, purchaseError: null }));
    try {
      const result = await purchaseItemApi(itemId);
      await load(workspaceId);
      update((s) => ({ ...s, purchasingId: null }));
      return result;
    } catch (err) {
      update((s) => ({ ...s, purchasingId: null, purchaseError: describePurchaseError(err) }));

      void load(workspaceId);
      return null;
    }
  }

  function dismissPurchaseError() {
    update((s) => ({ ...s, purchaseError: null }));
  }

  function canAfford(item: StoreItem, coins: number): boolean {
    return item.active && item.stock > 0 && coins >= item.price;
  }

  function reset() {
    loadedFor = null;
    set(initialState);
  }

  return {
    subscribe,
    load,
    ensureLoaded,
    purchase,
    dismissPurchaseError,
    canAfford,
    reset,
    get: () => get({ subscribe })
  };
}

export const storeStore = createStoreStore();
