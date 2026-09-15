import { supabase } from '$lib/supabase/client';
import type { ConsumableActivation, PurchaseItemResult, StoreItem } from '$lib/types/domain';

export class StoreApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'StoreApiError';
  }
}

/**
 * Spec section 23 "Store": "items disponibles". RLS (store_items_select)
 * already restricts non-owners to `active = true` items, so no extra filter
 * is needed here for a normal member — this mirrors that same restriction
 * explicitly so the intent is clear from this file alone.
 */
export async function fetchStoreItems(workspaceId: string): Promise<StoreItem[]> {
  const { data, error } = await supabase
    .from('store_items')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .order('price', { ascending: true });

  if (error) throw new StoreApiError(error.message, error.code);
  return (data ?? []) as StoreItem[];
}

/**
 * Spec section 16: "La consulta de efectos activos debe depender de
 * expires_at > NOW()", decided by the PostgreSQL server, never the device
 * clock. `.gt('expires_at', ...)` still needs *some* timestamp to send as
 * the comparison value — using the client's current time here only affects
 * which activations this particular list-refresh happens to show; it is
 * not used anywhere to decide whether an effect actually applies during
 * mission completion or a purchase (that's `complete_mission` /
 * `purchase_item`, which compare against `now()` inside Postgres itself).
 * Worst case with client-clock drift is this list being a few seconds stale
 * until the next refresh — never a wrong reward.
 */
export async function fetchActiveEffects(): Promise<ConsumableActivation[]> {
  const { data, error } = await supabase
    .from('consumable_activations')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  if (error) throw new StoreApiError(error.message, error.code);
  return (data ?? []) as ConsumableActivation[];
}

/**
 * Maps the custom SQLSTATE codes raised by `purchase_item` (0024) to a
 * friendly Spanish message. Falls back to the raw Postgres message for any
 * other error, so nothing is ever silently swallowed.
 */
const PURCHASE_ERROR_MESSAGES: Record<string, string> = {
  GM001: 'Debes iniciar sesión para comprar.',
  GM002: 'No tienes acceso a este item.',
  GM003: 'Este item ya no está disponible.',
  GM006: 'No tienes suficientes monedas para este item.',
  GM007: 'Este item está agotado por ahora.'
};

export function describePurchaseError(err: unknown): string {
  if (err instanceof StoreApiError && err.code) {
    const mapped = PURCHASE_ERROR_MESSAGES[err.code];
    if (mapped) return mapped;
  }
  if (err instanceof StoreApiError) return err.message;
  return 'No se pudo completar la compra.';
}

/** Spec section 18: calls the `purchase_item` RPC and returns its result. */
export async function purchaseItem(itemId: string): Promise<PurchaseItemResult> {
  const { data, error } = await supabase.rpc('purchase_item', { p_item_id: itemId });

  if (error) throw new StoreApiError(error.message, error.code);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new StoreApiError('purchase_item returned no result');

  return row as PurchaseItemResult;
}
