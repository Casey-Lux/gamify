import { supabase } from '$lib/supabase/client';
import type { ConsumableActivation, PurchaseItemResult, StoreItem } from '$lib/types/domain';
import { invalidate } from '$lib/utils/freshness';

export class StoreApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'StoreApiError';
  }
}

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

export async function fetchActiveEffects(): Promise<ConsumableActivation[]> {
  const { data, error } = await supabase
    .from('consumable_activations')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: true });

  if (error) throw new StoreApiError(error.message, error.code);
  return (data ?? []) as ConsumableActivation[];
}

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

export async function purchaseItem(itemId: string): Promise<PurchaseItemResult> {
  const { data, error } = await supabase.rpc('purchase_item', { p_item_id: itemId });

  if (error) throw new StoreApiError(error.message, error.code);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new StoreApiError('purchase_item returned no result');

  invalidate('store', 'statistics');
  return row as PurchaseItemResult;
}

import type { EffectType } from '$lib/types/domain';

export interface CreateStoreItemInput {
  workspace_id: string;
  name: string;
  description?: string | null;
  price: number;
  effect_type: EffectType;
  effect_value: number;
  duration_minutes: number;
}

export async function createStoreItem(input: CreateStoreItemInput): Promise<StoreItem> {
  const { data, error } = await supabase
    .from('store_items')
    .insert({
      workspace_id: input.workspace_id,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      effect_type: input.effect_type,
      effect_value: input.effect_value,
      duration_minutes: input.duration_minutes
    })
    .select('*')
    .single();

  if (error) throw new StoreApiError(error.message, error.code);
  invalidate('store');
  return data as StoreItem;
}
