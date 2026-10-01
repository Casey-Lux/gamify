<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { auth } from '$lib/stores/auth';
  import { workspaceStore } from '$lib/stores/workspace';
  import { skills, areas } from '$lib/stores/catalog';
  import { fetchMissionById, updateMission, MissionApiError } from '$lib/api/missions';
  import { fetchWorkspaceMembers, type WorkspaceMemberOption } from '$lib/api/workspace-members';
  import type { MissionWithRelations } from '$lib/types/domain';
  import { splitDueValue } from '$lib/utils/due-date';
  import MissionForm, { type MissionFormValues } from '$lib/components/missions/MissionForm.svelte';

  const missionId = $derived(page.params.id ?? '');
  const workspaceId = $derived($workspaceStore.activeWorkspaceId);
  const isOwner = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === workspaceId)?.role === 'OWNER'
  );

  let mission = $state<MissionWithRelations | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let members = $state<WorkspaceMemberOption[]>([]);
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  onMount(async () => {
    try {
      mission = await fetchMissionById(missionId);
    } catch (err) {
      loadError = err instanceof MissionApiError ? err.message : 'No se pudo cargar la misión.';
    } finally {
      loading = false;
    }
  });

  $effect(() => {
    if (isOwner && workspaceId) {
      void fetchWorkspaceMembers(workspaceId).then((list) => (members = list));
    }
  });

  const initial = $derived.by((): MissionFormValues | null => {
    if (!mission) return null;
    const due = splitDueValue(mission.due_at, mission.due_has_time);
    return {
      title: mission.title,
      description: mission.description ?? '',
      skillId: mission.skill_id,
      areaId: mission.area_id ?? '',
      difficulty: mission.difficulty,
      xpReward: mission.xp_reward,
      coinReward: mission.coin_reward,
      status: mission.status === 'DONE' ? 'DOING' : mission.status,
      dueDate: due.date,
      dueTime: due.time,
      assignedTo: mission.assigned_to,
      subtasks: [...mission.subtasks]
        .sort((a, b) => a.position - b.position)
        .map((t) => ({ id: t.id, title: t.title }))
    };
  });

  async function handleSubmit(values: MissionFormValues) {
    if (!mission) return;
    submitting = true;
    formError = null;
    try {
      await updateMission({
        missionId: mission.id,
        assignedTo: values.assignedTo || mission.assigned_to,
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
        subtasks: values.subtasks
      });
      await goto('/missions');
    } catch (err) {
      formError = err instanceof MissionApiError ? err.message : 'No se pudo guardar la misión.';
    } finally {
      submitting = false;
    }
  }
</script>

<main class="edit-mission-page">
  <header class="edit-mission-page__header">
    <h1>Editar misión</h1>
    <a href="/missions">Volver a misiones</a>
  </header>

  {#if loading}
    <p class="status">Cargando misión…</p>
  {:else if loadError}
    <p class="error" role="alert">{loadError}</p>
  {:else if !mission}
    <p class="status">No se encontró la misión o no tienes acceso a ella.</p>
  {:else if mission.completed_at}
    <p class="status">Una misión completada ya no se puede editar.</p>
  {:else if initial}
    <MissionForm
      {initial}
      skills={$skills}
      areas={$areas}
      {members}
      {isOwner}
      currentUserId={$auth.session?.user.id ?? null}
      lockSkill
      {submitting}
      submitLabel="Guardar cambios"
      submittingLabel="Guardando…"
      error={formError}
      onSubmit={handleSubmit}
    />
  {/if}
</main>

<style>
  .edit-mission-page {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .edit-mission-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .edit-mission-page__header h1 {
    margin: 0;
  }
  .status {
    color: var(--text-muted, #a0a0b0);
  }
  .error {
    color: #e0574f;
  }
</style>
