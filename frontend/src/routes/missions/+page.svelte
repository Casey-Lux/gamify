<script lang="ts">
  import { onMount } from 'svelte';
  import { missionsStore } from '$lib/stores/missions';
  import { skills, areas, catalogFromCache, catalogCachedAt } from '$lib/stores/catalog';
  import { auth } from '$lib/stores/auth';
  import { completeMission, setSubtaskCompleted, MissionApiError } from '$lib/api/missions';
  import { userSkillsStore } from '$lib/stores/user-skills';
  import MissionCard from '$lib/components/missions/MissionCard.svelte';
  import MissionFiltersPanel from '$lib/components/missions/MissionFiltersPanel.svelte';
  import MissionSortControl from '$lib/components/missions/MissionSortControl.svelte';
  import CachedNotice from '$lib/components/layout/CachedNotice.svelte';
  import { MISSION_PAGE_SIZE } from '$lib/types/mission-query';

  let completingId = $state<string | null>(null);
  let completionError = $state<string | null>(null);
  let lastReward = $state<{ xp: number; coins: number; leveledUp: boolean } | null>(null);

  onMount(() => {
    void missionsStore.load();
  });

  async function handleComplete(missionId: string) {
    completingId = missionId;
    completionError = null;
    try {
      const result = await completeMission(missionId);
      lastReward = {
        xp: result.xp_awarded,
        coins: result.coins_awarded,
        leveledUp: result.player_leveled_up
      };
      await Promise.all([missionsStore.load(), auth.refreshProfile(), userSkillsStore.load()]);
    } catch (err) {
      completionError =
        err instanceof MissionApiError ? err.message : 'No se pudo completar la misión.';
    } finally {
      completingId = null;
    }
  }

  async function handleSubtaskToggle(subtaskId: string, completed: boolean) {
    try {
      await setSubtaskCompleted(subtaskId, completed);
      await missionsStore.load();
    } catch (err) {
      completionError =
        err instanceof MissionApiError ? err.message : 'No se pudo actualizar la submisión.';
    }
  }

  const from = $derived($missionsStore.page * MISSION_PAGE_SIZE + 1);
  const to = $derived(
    Math.min(
      $missionsStore.page * MISSION_PAGE_SIZE + $missionsStore.missions.length,
      $missionsStore.totalCount
    )
  );
</script>

<main class="missions-page">
  <header class="missions-page__header">
    <h1>Misiones</h1>
    <div class="missions-page__header-actions">
      <a class="new-mission-link" href="/missions/new">+ Nueva misión</a>
      <MissionSortControl sort={$missionsStore.sort} onChange={missionsStore.setSort} />
    </div>
  </header>

  <MissionFiltersPanel
    filters={$missionsStore.filters}
    skills={$skills}
    areas={$areas}
    onChange={missionsStore.setFilters}
    onClearAll={missionsStore.clearFilters}
    onClearOne={missionsStore.clearFilter}
  />

  {#if $missionsStore.fromCache && $missionsStore.cachedAt}
    <CachedNotice cachedAt={$missionsStore.cachedAt} />
  {:else if $catalogFromCache && $catalogCachedAt}
    <CachedNotice cachedAt={$catalogCachedAt} />
  {/if}

  {#if lastReward}
    <div class="toast" role="status">
      +{lastReward.xp} XP · +{lastReward.coins} monedas
      {#if lastReward.leveledUp}· ¡Subiste de nivel!{/if}
      <button type="button" onclick={() => (lastReward = null)} aria-label="Cerrar">✕</button>
    </div>
  {/if}

  {#if completionError}
    <p class="error" role="alert">{completionError}</p>
  {/if}

  {#if $missionsStore.error}
    <p class="error" role="alert">{$missionsStore.error}</p>
  {:else if $missionsStore.loading}
    <p class="status">Cargando misiones…</p>
  {:else if $missionsStore.missions.length === 0}
    <p class="status">No hay misiones que coincidan con estos filtros.</p>
  {:else}
    <ul class="missions-list">
      {#each $missionsStore.missions as mission (mission.id)}
        <li>
          <MissionCard
            {mission}
            completing={completingId === mission.id}
            onComplete={handleComplete}
            onSubtaskToggle={handleSubtaskToggle}
          />
        </li>
      {/each}
    </ul>

    <nav class="pagination" aria-label="Paginación de misiones">
      <button
        type="button"
        disabled={$missionsStore.page === 0}
        onclick={missionsStore.previousPage}
      >
        Anterior
      </button>
      <span>{from}–{to} de {$missionsStore.totalCount}</span>
      <button type="button" disabled={!$missionsStore.hasMore} onclick={missionsStore.nextPage}>
        Siguiente
      </button>
    </nav>
  {/if}
</main>

<style>
  .missions-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .missions-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .missions-page__header h1 {
    margin: 0;
  }
  .missions-page__header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .new-mission-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.9rem;
    border-radius: 0.5rem;
    background: #4c6ef5;
    color: white;
    font-weight: 600;
    text-decoration: none;
  }
  .missions-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .status {
    color: #a0a0b0;
  }
  .error {
    color: #e0574f;
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
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }
  .pagination button {
    min-height: 44px;
    padding: 0.5rem 1rem;
    border-radius: 0.4rem;
    border: 1px solid #2c2c3a;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .pagination button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
