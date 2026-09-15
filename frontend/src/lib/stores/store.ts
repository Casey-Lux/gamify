import { writable, get } from 'svelte/store';
import {
  fetchStoreItems,
  fetchActiveEffects,
  purchaseItem as purchaseItemApi,
  describePurchaseError
} from '$lib/api/store';
import type { ConsumableActivation, StoreItem } from '$lib/types/domain';

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

  async function load(workspaceId: string) {
    update((s) => ({ ...s, loading: true, error: null }));
    try {
      const [items, activeEffects] = await Promise.all([
        fetchStoreItems(workspaceId),
        fetchActiveEffects()
      ]);
      update((s) => ({ ...s, items, activeEffects, loading: false }));
    } catch {
      update((s) => ({ ...s, loading: false, error: 'No se pudo cargar la tienda.' }));
    }
  }

  /** Re-fetches just the active-effects list (e.g. on a periodic tick to
   * drop expired ones, without re-fetching the whole item catalog). */
  async function refreshActiveEffects() {
    try {
      const activeEffects = await fetchActiveEffects();
      update((s) => ({ ...s, activeEffects }));
    } catch {
      // Silently keep the previous list — a transient failure here shouldn't
      // interrupt the countdown UI; the next tick will retry.
    }
  }

  /**
   * Returns the purchase result on success (caller uses it to show a toast
   * and refresh the profile balance/skills), or null if it failed (the
   * failure reason is left in state.purchaseError).
   */
  async function purchase(itemId: string, workspaceId: string) {
    update((s) => ({ ...s, purchasingId: itemId, purchaseError: null }));
    try {
      const result = await purchaseItemApi(itemId);
      await load(workspaceId);
      update((s) => ({ ...s, purchasingId: null }));
      return result;
    } catch (err) {
      update((s) => ({ ...s, purchasingId: null, purchaseError: describePurchaseError(err) }));
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
    set(initialState);
  }

  return {
    subscribe,
    load,
    refreshActiveEffects,
    purchase,
    dismissPurchaseError,
    canAfford,
    reset,
    get: () => get({ subscribe })
  };
}

export const storeStore = createStoreStore();
