<script lang="ts">
  import { goto } from '$app/navigation';
  import { workspaceStore } from '$lib/stores/workspace';
  import { skills, areas, loadCatalog } from '$lib/stores/catalog';
  import { createSkill, createArea, CatalogApiError } from '$lib/api/catalog';

  const workspaceId = $derived($workspaceStore.activeWorkspaceId);
  const role = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === workspaceId)?.role ?? null
  );
  const isOwner = $derived(role === 'OWNER');

  // Spec section 4: only an OWNER administers skills/areas. This mirrors
  // the redirect-on-auth pattern already used by src/routes/+layout.svelte —
  // client-side only, for UX; `skills_insert_owner`/`areas_insert_owner`
  // (0016_rls_policies.sql) are the actual authorization boundary.
  $effect(() => {
    if (role !== null && !isOwner) void goto('/missions');
  });

  let skillName = $state('');
  let skillDescription = $state('');
  let skillSubmitting = $state(false);
  let skillError = $state<string | null>(null);

  let areaName = $state('');
  let areaSubmitting = $state(false);
  let areaError = $state<string | null>(null);

  async function handleCreateSkill(e: SubmitEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    skillSubmitting = true;
    skillError = null;
    try {
      await createSkill(workspaceId, skillName, skillDescription);
      skillName = '';
      skillDescription = '';
      await loadCatalog(workspaceId);
    } catch (err) {
      skillError = err instanceof CatalogApiError ? err.message : 'No se pudo crear la skill.';
    } finally {
      skillSubmitting = false;
    }
  }

  async function handleCreateArea(e: SubmitEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    areaSubmitting = true;
    areaError = null;
    try {
      await createArea(workspaceId, areaName);
      areaName = '';
      await loadCatalog(workspaceId);
    } catch (err) {
      areaError = err instanceof CatalogApiError ? err.message : 'No se pudo crear el área.';
    } finally {
      areaSubmitting = false;
    }
  }
</script>

<main class="manage-page">
  <h1>Gestionar workspace</h1>

  {#if isOwner}
    <section class="card">
      <h2>Skills</h2>
      <p class="hint">
        Cada misión pertenece a exactamente una skill. Los miembros ganan XP y nivel propios en cada
        skill al completar misiones.
      </p>
      {#if $skills.length > 0}
        <ul class="item-list">
          {#each $skills as skill (skill.id)}
            <li>
              <strong>{skill.name}</strong>
              {#if skill.description}<span class="muted"> — {skill.description}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <form onsubmit={handleCreateSkill}>
        <label>
          Nombre
          <input type="text" bind:value={skillName} required maxlength="60" />
        </label>
        <label>
          Descripción (opcional)
          <input type="text" bind:value={skillDescription} maxlength="500" />
        </label>
        {#if skillError}<p class="error" role="alert">{skillError}</p>{/if}
        <button type="submit" disabled={skillSubmitting}>
          {skillSubmitting ? 'Creando…' : 'Crear skill'}
        </button>
      </form>
    </section>

    <section class="card">
      <h2>Áreas</h2>
      <p class="hint">Una misión puede pertenecer opcionalmente a un área.</p>
      {#if $areas.length > 0}
        <ul class="item-list">
          {#each $areas as area (area.id)}
            <li><strong>{area.name}</strong></li>
          {/each}
        </ul>
      {/if}
      <form onsubmit={handleCreateArea}>
        <label>
          Nombre
          <input type="text" bind:value={areaName} required maxlength="60" />
        </label>
        {#if areaError}<p class="error" role="alert">{areaError}</p>{/if}
        <button type="submit" disabled={areaSubmitting}>
          {areaSubmitting ? 'Creando…' : 'Crear área'}
        </button>
      </form>
    </section>
  {/if}
</main>

<style>
  .manage-page {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .manage-page h1 {
    margin: 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .card h2 {
    margin: 0;
    font-size: 1rem;
  }
  .hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted, #a0a0b0);
  }
  .item-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
  }
  .muted {
    color: var(--text-muted, #a0a0b0);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  input {
    min-height: 44px;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
  }
  button[type='submit'] {
    align-self: flex-start;
    min-height: 44px;
    padding: 0.5rem 1.2rem;
    border-radius: 0.5rem;
    border: none;
    background: #4c6ef5;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  button[type='submit']:disabled {
    background: #3a3a4a;
    cursor: not-allowed;
  }
  .error {
    margin: 0;
    font-size: 0.85rem;
    color: #e0574f;
  }
</style>
