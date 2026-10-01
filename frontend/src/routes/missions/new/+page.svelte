<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth';
  import { workspaceStore } from '$lib/stores/workspace';
  import { skills, areas } from '$lib/stores/catalog';
  import { createMission, MissionApiError } from '$lib/api/missions';
  import { fetchWorkspaceMembers, type WorkspaceMemberOption } from '$lib/api/workspace-members';
  import MissionForm, { type MissionFormValues } from '$lib/components/missions/MissionForm.svelte';

  const workspaceId = $derived($workspaceStore.activeWorkspaceId);
  const role = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === workspaceId)?.role ?? null
  );
  const isOwner = $derived(role === 'OWNER');

  const initial: MissionFormValues = {
    title: '',
    description: '',
    skillId: '',
    areaId: '',
    difficulty: 'EASY',
    xpReward: 10,
    coinReward: 5,
    status: 'TODO',
    dueDate: '',
    dueTime: '',
    assignedTo: '',
    subtasks: [{ title: '' }]
  };

  let members = $state<WorkspaceMemberOption[]>([]);
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  // Only an OWNER can assign a mission to someone else (spec section 4 +
  // RLS `missions_insert`), so the member list is only ever needed then.
  $effect(() => {
    if (isOwner && workspaceId) {
      void fetchWorkspaceMembers(workspaceId).then((list) => (members = list));
    }
  });

  async function handleSubmit(values: MissionFormValues) {
    if (!workspaceId || !$auth.session) return;
    submitting = true;
    formError = null;
    try {
      await createMission({
        workspaceId,
        createdBy: $auth.session.user.id,
        assignedTo: values.assignedTo || $auth.session.user.id,
        skillId: values.skillId,
        areaId: values.areaId.length > 0 ? values.areaId : null,
        title: values.title,
        description: values.description,
        difficulty: values.difficulty,
        xpReward: values.xpReward,
        coinReward: values.coinReward,
        status: values.status,
        dueDate: values.dueDate,
        dueTime: values.dueTime,
        subtaskTitles: values.subtasks.map((t) => t.title)
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
    <MissionForm
      {initial}
      skills={$skills}
      areas={$areas}
      {members}
      {isOwner}
      currentUserId={$auth.session?.user.id ?? null}
      {submitting}
      submitLabel="Crear misión"
      submittingLabel="Creando…"
      error={formError}
      onSubmit={handleSubmit}
    />
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
  .status {
    color: var(--text-muted, #a0a0b0);
  }
  .status a {
    color: #6fa8ff;
  }
</style>
