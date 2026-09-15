<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { workspaceStore } from '$lib/stores/workspace';
  import { skills, areas } from '$lib/stores/catalog';
  import { createMission, MissionApiError } from '$lib/api/missions';
  import { fetchWorkspaceMembers, type WorkspaceMemberOption } from '$lib/api/workspace-members';
  import type { MissionDifficulty } from '$lib/types/domain';
  import { DIFFICULTY_LABEL } from '$lib/utils/format';

  const workspaceId = $derived($workspaceStore.activeWorkspaceId);
  const role = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === workspaceId)?.role ?? null
  );
  const isOwner = $derived(role === 'OWNER');

  let title = $state('');
  let description = $state('');
  let skillId = $state('');
  let areaId = $state('');
  let difficulty = $state<MissionDifficulty>('EASY');
  let xpReward = $state(10);
  let coinReward = $state(5);
  let dueAt = $state('');
  let subtasks = $state<string[]>(['']);
  let assignedTo = $state<string>('');

  let members = $state<WorkspaceMemberOption[]>([]);
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  // Defaults the skill select once the catalog has loaded, and the
  // assignee to "myself" once we know who that is — both re-run harmlessly
  // if the user hasn't touched the field yet.
  $effect(() => {
    if (!skillId && $skills[0]) skillId = $skills[0].id;
  });
  $effect(() => {
    if (!assignedTo && $auth.session) assignedTo = $auth.session.user.id;
  });
  // Only an OWNER can assign a mission to someone else (spec section 4 +
  // RLS `missions_insert`), so the member list is only ever needed then.
  $effect(() => {
    if (isOwner && workspaceId) {
      void fetchWorkspaceMembers(workspaceId).then((list) => (members = list));
    }
  });

  function addSubtaskRow() {
    subtasks = [...subtasks, ''];
  }
  function removeSubtaskRow(index: number) {
    subtasks = subtasks.filter((_, i) => i !== index);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!workspaceId || !$auth.session) return;
    submitting = true;
    formError = null;
    try {
      await createMission({
        workspaceId,
        createdBy: $auth.session.user.id,
        assignedTo: assignedTo || $auth.session.user.id,
        skillId,
        areaId: areaId.length > 0 ? areaId : null,
        title,
        description,
        difficulty,
        xpReward: Number(xpReward),
        coinReward: Number(coinReward),
        dueAt,
        subtaskTitles: subtasks
      });
      await goto('/missions');
    } catch (err) {
      formError = err instanceof MissionApiError ? err.message : 'No se pudo crear la misión.';
    } finally {
      submitting = false;
    }
  }
</script>

<main class="new-mission-page">
  <header class="new-mission-page__header">
    <h1>Nueva misión</h1>
    <a href="/missions">Volver a misiones</a>
  </header>

  {#if $skills.length === 0}
    <p class="status">
      Todavía no hay ninguna skill en este workspace. {#if isOwner}<a href="/manage"
          >Crea una primero</a
        >.{:else}Pídele a un OWNER que cree una.{/if}
    </p>
  {:else}
    <form class="card" onsubmit={handleSubmit}>
      <label>
        Título
        <input type="text" bind:value={title} required maxlength="120" />
      </label>

      <label>
        Descripción
        <textarea bind:value={description} maxlength="2000" rows="3"></textarea>
      </label>

      <div class="grid-2">
        <label>
          Skill
          <select bind:value={skillId} required>
            {#each $skills as skill (skill.id)}
              <option value={skill.id}>{skill.name}</option>
            {/each}
          </select>
        </label>

        <label>
          Área (opcional)
          <select bind:value={areaId}>
            <option value="">Sin área</option>
            {#each $areas as area (area.id)}
              <option value={area.id}>{area.name}</option>
            {/each}
          </select>
        </label>
      </div>

      <div class="grid-2">
        <label>
          Dificultad
          <select bind:value={difficulty}>
            {#each Object.entries(DIFFICULTY_LABEL) as [value, label] (value)}
              <option {value}>{label}</option>
            {/each}
          </select>
        </label>

        <label>
          Fecha límite (opcional)
          <input type="datetime-local" bind:value={dueAt} />
        </label>
      </div>

      <div class="grid-2">
        <label>
          Recompensa de XP
          <input type="number" bind:value={xpReward} min="0" step="1" required />
        </label>
        <label>
          Recompensa de monedas
          <input type="number" bind:value={coinReward} min="0" step="1" required />
        </label>
      </div>

      {#if isOwner && members.length > 0}
        <label>
          Asignar a
          <select bind:value={assignedTo}>
            {#each members as member (member.userId)}
              <option value={member.userId}>
                {member.userId === $auth.session?.user.id
                  ? `${member.displayName} (yo)`
                  : member.displayName}
              </option>
            {/each}
          </select>
        </label>
      {/if}

      <fieldset class="subtasks">
        <legend>Submisiones (opcional)</legend>
        {#each subtasks as _subtask, index (index)}
          <div class="subtask-row">
            <input
              type="text"
              bind:value={subtasks[index]}
              placeholder="Título de la submisión"
              maxlength="120"
            />
            <button
              type="button"
              class="remove-btn"
              onclick={() => removeSubtaskRow(index)}
              aria-label="Quitar submisión"
            >
              ✕
            </button>
          </div>
        {/each}
        <button type="button" class="add-btn" onclick={addSubtaskRow}>+ Añadir submisión</button>
      </fieldset>

      {#if formError}<p class="error" role="alert">{formError}</p>{/if}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Creando…' : 'Crear misión'}
      </button>
    </form>
  {/if}
</main>

<style>
  .new-mission-page {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .new-mission-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .new-mission-page__header h1 {
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
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  @media (max-width: 480px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
  input,
  select,
  textarea {
    min-height: 44px;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
    font-family: inherit;
  }
  textarea {
    min-height: auto;
    resize: vertical;
  }
  fieldset.subtasks {
    border: 1px solid var(--border, #2c2c3a);
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  legend {
    padding: 0 0.4rem;
    font-size: 0.85rem;
    color: var(--text-muted, #a0a0b0);
  }
  .subtask-row {
    display: flex;
    gap: 0.5rem;
  }
  .subtask-row input {
    flex: 1;
  }
  .remove-btn,
  .add-btn {
    min-height: 44px;
    min-width: 44px;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .add-btn {
    align-self: flex-start;
    padding: 0 0.75rem;
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
  .status {
    color: var(--text-muted, #a0a0b0);
  }
  .status a {
    color: #6fa8ff;
  }
  .error {
    margin: 0;
    font-size: 0.85rem;
    color: #e0574f;
  }
</style>
