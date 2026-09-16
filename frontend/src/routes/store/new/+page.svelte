<script lang="ts">
  import { goto } from '$app/navigation';
  import { createStoreItem, StoreApiError } from '$lib/api/store';
  import { storeStore } from '$lib/stores/store';
  import { workspaceStore } from '$lib/stores/workspace';
  import type { EffectType } from '$lib/types/domain';

  const EFFECT_LABEL: Record<EffectType, string> = {
    XP_MULTIPLIER: 'Multiplicador de XP',
    COIN_MULTIPLIER: 'Multiplicador de monedas',
    XP_FLAT_BONUS: 'Bono fijo de XP',
    COIN_FLAT_BONUS: 'Bono fijo de monedas'
  };
  const effectTypes = Object.keys(EFFECT_LABEL) as EffectType[];

  const workspaceId = $derived($workspaceStore.activeWorkspaceId);

  let name = $state('');
  let description = $state('');
  let price = $state(10);
  let effectType = $state<EffectType>('XP_MULTIPLIER');
  let effectValue = $state(1);
  let durationMinutes = $state(10);

  let submitting = $state(false);
  let error = $state<string | null>(null);

  // Espejo exacto de los CHECK constraints de 0011_store_items.sql, para dar
  // feedback inmediato en vez de esperar el error 400 de Postgres.
  const validationError = $derived.by(() => {
    if (name.trim().length === 0) return 'El nombre no puede estar vacío.';
    if (price < 0) return 'El precio no puede ser negativo.';
    if (effectValue <= 0) return 'El valor del efecto debe ser mayor que 0.';
    if (durationMinutes < 1 || durationMinutes > 30) {
      return 'La duración debe estar entre 1 y 30 minutos.';
    }
    return null;
  });

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!workspaceId || validationError) return;

    submitting = true;
    error = null;
    try {
      await createStoreItem({
        workspace_id: workspaceId,
        name: name.trim(),
        description: description.trim() || null,
        price,
        effect_type: effectType,
        effect_value: effectValue,
        duration_minutes: durationMinutes
      });
      await storeStore.load(workspaceId);
      // Ajusta esta ruta si tu página de tienda vive en otra URL (p. ej. /tienda).
      await goto('/store');
    } catch (err) {
      error =
        err instanceof StoreApiError
          ? err.message
          : 'No se pudo crear el item. Intenta de nuevo.';
    } finally {
      submitting = false;
    }
  }
</script>

<main class="new-item-page">
  <h1>Nuevo item de tienda</h1>

  <form onsubmit={handleSubmit}>
    <label>
      Nombre
      <input type="text" bind:value={name} required />
    </label>

    <label>
      Descripción (opcional)
      <textarea bind:value={description} rows="3"></textarea>
    </label>

    <label>
      Precio (monedas)
      <input type="number" min="0" bind:value={price} required />
    </label>

    <label>
      Tipo de efecto
      <select bind:value={effectType}>
        {#each effectTypes as et (et)}
          <option value={et}>{EFFECT_LABEL[et]}</option>
        {/each}
      </select>
    </label>

    <label>
      Valor del efecto
      <input type="number" min="0.01" step="0.01" bind:value={effectValue} required />
    </label>

    <label>
      Duración (minutos, 1–30)
      <input type="number" min="1" max="30" bind:value={durationMinutes} required />
    </label>

    {#if validationError}
      <p class="error" role="alert">{validationError}</p>
    {/if}
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <div class="actions">
      <a href="/store">Cancelar</a>
      <button type="submit" disabled={submitting || !!validationError}>
        {submitting ? 'Creando…' : 'Crear item'}
      </button>
    </div>
  </form>
</main>

<style>
  .new-item-page {
    max-width: 480px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  input,
  textarea,
  select {
    min-height: 44px;
    padding: 0.4rem 0.6rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
    font: inherit;
  }
  .error {
    color: #e0574f;
    margin: 0;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
  }
  .actions a {
    color: inherit;
  }
  .actions button {
    min-height: 44px;
    padding: 0.5rem 1.2rem;
    border-radius: 0.5rem;
    background: #4c6ef5;
    color: white;
    font-weight: 600;
    border: none;
    cursor: pointer;
  }
  .actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
