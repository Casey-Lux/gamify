<script lang="ts">
  import type { StoreItem } from '$lib/types/domain';
  import { EFFECT_TYPE_LABEL, formatEffectValue } from '$lib/utils/format';

  interface Props {
    item: StoreItem;
    userCoins: number;
    purchasing: boolean;
    onPurchase: (itemId: string) => void;
  }

  let { item, userCoins, purchasing, onPurchase }: Props = $props();

  const outOfStock = $derived(item.stock <= 0);
  const insufficientFunds = $derived(userCoins < item.price);
  const canBuy = $derived(!outOfStock && !insufficientFunds && !purchasing);
</script>

<article class="store-item" class:out-of-stock={outOfStock}>
  <header class="store-item__header">
    <h3>{item.name}</h3>
    <span class="price">{item.price} monedas</span>
  </header>

  {#if item.description}
    <p class="description">{item.description}</p>
  {/if}

  <dl class="store-item__meta">
    <div>
      <dt>Stock</dt>
      <dd>{item.stock}/{item.max_stock}</dd>
    </div>
    <div>
      <dt>Duración</dt>
      <dd>{item.duration_minutes} min</dd>
    </div>
    <div>
      <dt>Efecto</dt>
      <dd>
        {EFFECT_TYPE_LABEL[item.effect_type]}
        {formatEffectValue(item.effect_type, item.effect_value)}
      </dd>
    </div>
  </dl>

  <button type="button" disabled={!canBuy} onclick={() => onPurchase(item.id)}>
    {#if purchasing}
      Comprando…
    {:else if outOfStock}
      Agotado
    {:else}
      Comprar
    {/if}
  </button>

  {#if insufficientFunds && !outOfStock}
    <p class="rejection" role="alert">No tienes suficientes monedas para este item.</p>
  {/if}
</article>

<style>
  .store-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .store-item.out-of-stock {
    opacity: 0.6;
  }
  .store-item__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .store-item__header h3 {
    margin: 0;
    font-size: 1.05rem;
  }
  .price {
    font-weight: 600;
    color: #f0c419;
    white-space: nowrap;
  }
  .description {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-muted, #a0a0b0);
  }
  .store-item__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0;
    font-size: 0.85rem;
  }
  .store-item__meta div {
    display: flex;
    gap: 0.25rem;
  }
  .store-item__meta dt {
    color: var(--text-muted, #a0a0b0);
  }
  .store-item__meta dd {
    margin: 0;
  }
  button {
    min-height: 44px;
    padding: 0.6rem 1rem;
    border-radius: 0.5rem;
    border: none;
    background: var(--accent, #4c6ef5);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    background: var(--disabled, #3a3a4a);
    cursor: not-allowed;
  }
  .rejection {
    margin: 0;
    font-size: 0.8rem;
    color: #e0574f;
  }
</style>
