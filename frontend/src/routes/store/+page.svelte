<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { storeStore } from '$lib/stores/store';
  import { workspaceStore } from '$lib/stores/workspace';
  import { auth } from '$lib/stores/auth';
  import StoreItemCard from '$lib/components/store/StoreItemCard.svelte';
  import ActiveEffectsList from '$lib/components/store/ActiveEffectsList.svelte';

  let lastPurchase = $state<{ itemName: string } | null>(null);
  let refreshIntervalId: ReturnType<typeof setInterval> | undefined;

  const workspaceId = $derived($workspaceStore.activeWorkspaceId);

  onMount(() => {
    // Slow background refresh so effects that expired since the last load
    // drop off the list even if the user doesn't purchase anything else.
    refreshIntervalId = setInterval(() => void storeStore.refreshActiveEffects(), 30_000);
  });

  onDestroy(() => {
    if (refreshIntervalId) clearInterval(refreshIntervalId);
  });

  $effect(() => {
    if (workspaceId) void storeStore.load(workspaceId);
  });

  async function handlePurchase(itemId: string) {
    if (!workspaceId) return;
    lastPurchase = null;
    const item = $storeStore.items.find((i) => i.id === itemId);
    const result = await storeStore.purchase(itemId, workspaceId);
    if (result && item) {
      lastPurchase = { itemName: item.name };
      await auth.refreshProfile();
    }
  }
</script>

<main class="store-page">
  <header class="store-page__header">
    <h1>Tienda</h1>
    <span class="balance">Saldo: {$auth.profile?.coins ?? 0} monedas</span>
  </header>

  <ActiveEffectsList effects={$storeStore.activeEffects} />

  {#if lastPurchase}
    <div class="toast" role="status">
      Compraste "{lastPurchase.itemName}" — efecto activado.
      <button type="button" onclick={() => (lastPurchase = null)} aria-label="Cerrar">✕</button>
    </div>
  {/if}

  {#if $storeStore.purchaseError}
    <p class="error" role="alert">
      {$storeStore.purchaseError}
      <button type="button" onclick={storeStore.dismissPurchaseError} aria-label="Cerrar">✕</button>
    </p>
  {/if}

  {#if $storeStore.error}
    <p class="error" role="alert">{$storeStore.error}</p>
  {:else if $storeStore.loading}
    <p class="status">Cargando tienda…</p>
  {:else if $storeStore.items.length === 0}
    <p class="status">No hay items disponibles en este momento.</p>
  {:else}
    <ul class="store-list">
      {#each $storeStore.items as item (item.id)}
        <li>
          <StoreItemCard
            {item}
            userCoins={$auth.profile?.coins ?? 0}
            purchasing={$storeStore.purchasingId === item.id}
            onPurchase={handlePurchase}
          />
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .store-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .store-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .store-page__header h1 {
    margin: 0;
  }
  .balance {
    font-weight: 600;
    color: #f0c419;
  }
  .store-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 0.75rem;
  }
  .status {
    color: #a0a0b0;
  }
  .error {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #e0574f;
  }
  .error button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    border-radius: 0.5rem;
    background: #2c5c3a;
    font-weight: 600;
  }
  .toast button {
    margin-left: auto;
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
  }
</style>
