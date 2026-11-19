<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { workspaceStore } from '$lib/stores/workspace';
  import { userSkillsStore } from '$lib/stores/user-skills';
  import { isoWeekday, toLocalDateStr } from '$lib/utils/habit-schedule';
  import { WEEKDAY_LABEL } from '$lib/types/habits';
  import { dailyMissionSlots, type DailyPlan, type DailyPlanSettings } from '$lib/types/daily-plan';
  import {
    DailyPlanApiError,
    fetchDailyPlanSettings,
    getOrCreateDailyPlan,
    saveDailyPlanSettings
  } from '$lib/api/daily-plan';
  import {
    completeMission,
    deleteMission,
    setSubtaskCompleted,
    startMission,
    MissionApiError
  } from '$lib/api/missions';
  import type { MissionWithRelations } from '$lib/types/domain';
  import MissionCard from '$lib/components/missions/MissionCard.svelte';

  const today = toLocalDateStr();
  const weekday = isoWeekday(today);
  const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

  let settings = $state<DailyPlanSettings>({ hours: [0, 0, 0, 0, 0, 0, 0] });
  let plan = $state<DailyPlan | null>(null);
  let loading = $state(true);
  let saving = $state(false);
  let settingsSaved = $state(false);
  let loadError = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let settingsError = $state<string | null>(null);
  let startingId = $state<string | null>(null);
  let completingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let lastReward = $state<{ xp: number; coins: number; leveledUp: boolean } | null>(null);

  const todayHours = $derived(settings.hours[weekday - 1] ?? 0);
  const todaySlots = $derived(dailyMissionSlots(todayHours));
  const shownHours = $derived(plan?.locked ? plan.hours : todayHours);
  const shownSlots = $derived(plan?.locked ? plan.slots : todaySlots);

  let loadedKey = '';

  $effect(() => {
    const userId = $auth.session?.user.id;
    const workspaceId = $workspaceStore.activeWorkspaceId;
    if (!userId || !workspaceId) return;

    const key = `${userId}:${workspaceId}`;
    if (key === loadedKey) return;
    loadedKey = key;
    void load(userId, workspaceId);
  });

  function describeError(err: unknown, fallback: string): string {
    if (err instanceof DailyPlanApiError || err instanceof MissionApiError) return err.message;
    return fallback;
  }

  async function load(userId: string, workspaceId: string) {
    loading = true;
    loadError = null;
    try {
      settings = await fetchDailyPlanSettings(userId);
      await loadPlan(userId, workspaceId);
    } catch (err) {
      loadError = describeError(err, 'No se pudo cargar el plan diario.');
    } finally {
      loading = false;
    }
  }

  async function loadPlan(userId: string, workspaceId: string) {
    const hours = settings.hours[weekday - 1] ?? 0;
    plan = await getOrCreateDailyPlan({
      userId,
      workspaceId,
      planDate: today,
      hours,
      slots: dailyMissionSlots(hours)
    });
  }

  async function refreshPlan() {
    const userId = $auth.session?.user.id;
    const workspaceId = $workspaceStore.activeWorkspaceId;
    if (!userId || !workspaceId) return;
    await loadPlan(userId, workspaceId);
  }

  function formatHours(hours: number): string {
    return `${hours.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`;
  }

  async function handleSaveSettings(event: SubmitEvent) {
    event.preventDefault();
    const userId = $auth.session?.user.id;
    const workspaceId = $workspaceStore.activeWorkspaceId;
    if (!userId || !workspaceId) return;

    saving = true;
    settingsSaved = false;
    settingsError = null;
    try {
      const hours = settings.hours.map((value) => (Number.isFinite(value) ? value : 0));
      settings = await saveDailyPlanSettings(userId, hours);
      await loadPlan(userId, workspaceId);
      settingsSaved = true;
    } catch (err) {
      settingsError = describeError(err, 'No se pudo guardar el tiempo libre.');
    } finally {
      saving = false;
    }
  }

  async function handleStart(missionId: string) {
    startingId = missionId;
    actionError = null;
    try {
      await startMission(missionId);
      await refreshPlan();
    } catch (err) {
      actionError = describeError(err, 'No se pudo iniciar la misión.');
      void refreshPlan();
    } finally {
      startingId = null;
    }
  }

  async function handleComplete(missionId: string) {
    completingId = missionId;
    actionError = null;
    try {
      const result = await completeMission(missionId);
      lastReward = {
        xp: result.xp_awarded,
        coins: result.coins_awarded,
        leveledUp: result.player_leveled_up
      };
      await Promise.all([refreshPlan(), auth.refreshProfile(), userSkillsStore.load()]);
    } catch (err) {
      actionError = describeError(err, 'No se pudo completar la misión.');
      void refreshPlan();
    } finally {
      completingId = null;
    }
  }

  async function handleDelete(mission: MissionWithRelations) {
    if (
      !window.confirm(`¿Eliminar la misión "${mission.title}"? Esta acción no se puede deshacer.`)
    ) {
      return;
    }

    deletingId = mission.id;
    actionError = null;
    try {
      await deleteMission(mission.id);
      await refreshPlan();
    } catch (err) {
      actionError = describeError(err, 'No se pudo eliminar la misión.');
      void refreshPlan();
    } finally {
      deletingId = null;
    }
  }

  async function handleSubtaskToggle(subtaskId: string, completed: boolean) {
    actionError = null;
    try {
      await setSubtaskCompleted(subtaskId, completed);
      await refreshPlan();
    } catch (err) {
      actionError = describeError(err, 'No se pudo actualizar la submisión.');
      void refreshPlan();
    }
  }
</script>

<main class="daily-plan-page">
  <header class="daily-plan-page__header">
    <h1>Plan diario</h1>
    <p class="subtitle">
      Hasta 3 misiones fáciles ya iniciadas, ordenadas por vencimiento y recompensa.
    </p>
  </header>

  {#if loadError}
    <p class="error" role="alert">{loadError}</p>
  {/if}
  {#if actionError}
    <p class="error" role="alert">{actionError}</p>
  {/if}

  {#if loading}
    <p class="status">Cargando plan…</p>
  {:else}
    {#if lastReward}
      <div class="toast" role="status">
        +{lastReward.xp} XP · +{lastReward.coins} monedas
        {#if lastReward.leveledUp}· ¡Subiste de nivel!{/if}
        <button type="button" onclick={() => (lastReward = null)} aria-label="Cerrar">✕</button>
      </div>
    {/if}

    <section class="panel">
      <div class="panel__heading">
        <div>
          <h2>Hoy · {WEEKDAY_LABEL[weekday]}</h2>
          <p class="meta">
            {formatHours(shownHours)} libres ·
            {plan?.entries.length ?? 0}
            de
            {shownSlots}
            {shownSlots === 1 ? 'misión' : 'misiones'}
          </p>
        </div>
        {#if plan?.locked}
          <span class="badge">Plan fijado</span>
        {/if}
      </div>

      {#if plan && plan.entries.length > 0}
        <ul class="plan-list">
          {#each plan.entries as entry (entry.mission.id)}
            <li>
              <MissionCard
                mission={entry.mission}
                starting={startingId === entry.mission.id}
                completing={completingId === entry.mission.id}
                deleting={deletingId === entry.mission.id}
                onStart={handleStart}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onSubtaskToggle={handleSubtaskToggle}
              />
            </li>
          {/each}
        </ul>
      {:else if !plan?.locked && todaySlots === 0}
        <p class="empty">
          Configura al menos 2 horas para hoy en el apartado de abajo para recibir una misión.
        </p>
      {:else}
        <p class="empty">
          No hay misiones Doing fáciles disponibles. Inicia una misión fácil en Misiones y vuelve a
          esta página.
        </p>
      {/if}

      {#if plan?.locked}
        <p class="note">
          El plan de hoy queda fijado al generarse. Si completas una misión, seguirá en la lista
          como completada.
        </p>
      {/if}
    </section>

    <section class="panel">
      <h2>Tiempo libre por día</h2>
      <p class="note">
        Cada misión fácil se estima en 2 horas. Con 2 h se asigna 1 misión, con 4 h se asignan 2 y
        con 6 h o más se asignan 3. Las misiones medias y difíciles no entran en el plan.
      </p>

      <form onsubmit={handleSaveSettings}>
        <div class="weekday-grid">
          {#each WEEKDAYS as day (day)}
            <label>
              <span>{WEEKDAY_LABEL[day]}</span>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                bind:value={settings.hours[day - 1]}
              />
            </label>
          {/each}
        </div>

        <div class="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar tiempo libre'}
          </button>
          {#if settingsSaved}
            <span class="saved" role="status">Guardado</span>
          {/if}
          {#if settingsError}
            <span class="error" role="alert">{settingsError}</span>
          {/if}
        </div>
      </form>
    </section>
  {/if}
</main>

<style>
  .daily-plan-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .daily-plan-page__header h1 {
    margin: 0;
  }
  .subtitle {
    margin: 0.25rem 0 0;
    color: var(--text-muted, #a0a0b0);
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .panel h2 {
    margin: 0;
    font-size: 1.1rem;
  }
  .panel__heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .meta {
    margin: 0.25rem 0 0;
    color: var(--text-muted, #a0a0b0);
    font-size: 0.9rem;
  }
  .badge {
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: #2c4a7a;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .plan-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .empty,
  .note {
    margin: 0;
    color: var(--text-muted, #a0a0b0);
    font-size: 0.9rem;
  }
  .weekday-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 0.75rem;
  }
  .weekday-grid label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .weekday-grid input {
    min-height: 44px;
    padding: 0 0.6rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border, #2c2c3a);
    background: #14141f;
    color: inherit;
    font: inherit;
  }
  .form-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
  .form-actions button {
    min-height: 44px;
    padding: 0 1rem;
    border: none;
    border-radius: 0.5rem;
    background: var(--accent, #4c6ef5);
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  .form-actions button:disabled {
    background: var(--disabled, #3a3a4a);
    cursor: not-allowed;
  }
  .saved {
    color: #6fcf97;
    font-weight: 600;
  }
  .status {
    color: var(--text-muted, #a0a0b0);
  }
  .error {
    margin: 0;
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
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
</style>
