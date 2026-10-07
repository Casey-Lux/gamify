<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { workspaceStore } from '$lib/stores/workspace';
  import { skills, areas } from '$lib/stores/catalog';
  import { createHabit, HabitApiError } from '$lib/api/habits';
  import HabitForm, { type HabitFormValues } from '$lib/components/habits/HabitForm.svelte';

  const workspaceId = $derived($workspaceStore.activeWorkspaceId);
  const isOwner = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === workspaceId)?.role === 'OWNER'
  );

  // "Diario" is checked by default.
  const initial: HabitFormValues = {
    title: '',
    description: '',
    skillId: '',
    areaId: '',
    difficulty: 'EASY',
    xpReward: 10,
    coinReward: 5,
    daily: true,
    days: [1, 2, 3, 4, 5, 6, 7],
    dayPart: 'ANYTIME',
    reminderTime: '',
    adaptive: true
  };

  let submitting = $state(false);
  let formError = $state<string | null>(null);

  async function handleSubmit(values: HabitFormValues) {
    if (!workspaceId || !$auth.session) return;
    submitting = true;
    formError = null;
    try {
      await createHabit(workspaceId, $auth.session.user.id, {
        ...values,
        areaId: values.areaId.length > 0 ? values.areaId : null
      });
      await goto('/habits');
    } catch (err) {
      formError = err instanceof HabitApiError ? err.message : 'No se pudo crear el hábito.';
    } finally {
      submitting = false;
    }
  }
</script>

<main class="habit-page">
  <header class="habit-page__header">
    <h1>Nuevo hábito</h1>
    <a href="/habits">Volver a hábitos</a>
  </header>

  {#if $skills.length === 0}
    <p class="status">
      Todavía no hay ninguna skill en este workspace. {#if isOwner}<a href="/manage"
          >Crea una primero</a
        >.{:else}Pídele a un OWNER que cree una.{/if}
    </p>
  {:else}
    <HabitForm
      {initial}
      skills={$skills}
      areas={$areas}
      {submitting}
      submitLabel="Crear hábito"
      submittingLabel="Creando…"
      error={formError}
      onSubmit={handleSubmit}
    />
  {/if}
</main>

<style>
  .habit-page {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .habit-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .habit-page__header h1 {
    margin: 0;
  }
  .status {
    color: var(--text-muted, #a0a0b0);
  }
  .status a {
    color: #6fa8ff;
  }
</style>
