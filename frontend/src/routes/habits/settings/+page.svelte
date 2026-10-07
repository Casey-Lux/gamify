<script lang="ts">
  import { onMount } from 'svelte';
  import { habitsStore } from '$lib/stores/habits';
  import { setHabitArchived, HabitApiError } from '$lib/api/habits';
  import { computeWeekdayStats } from '$lib/utils/habit-adaptation';
  import { describeDays } from '$lib/utils/habit-schedule';
  import { HABIT_DAY_PART_LABEL, WEEKDAY_SHORT, type Habit } from '$lib/types/habits';

  let busyId = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  onMount(() => {
    void habitsStore.load();
  });

  const active = $derived($habitsStore.habits.filter((h) => h.archived_at === null));
  const archived = $derived($habitsStore.habits.filter((h) => h.archived_at !== null));

  const PLAN_SYMBOL = { REQUIRED: '●', REMINDER: '◐', OPTIONAL: '○' } as const;
  const PLAN_LABEL = {
    REQUIRED: 'requerido',
    REMINDER: 'recordatorio especial',
    OPTIONAL: 'opcional'
  } as const;

  function stats(habit: Habit) {
    return computeWeekdayStats(
      $habitsStore.schedules[habit.id] ?? [],
      $habitsStore.completed[habit.id] ?? [],
      $habitsStore.today
    );
  }

  async function toggleArchived(habit: Habit) {
    const archiving = habit.archived_at === null;
    if (
      archiving &&
      !window.confirm(
        `¿Archivar «${habit.title}»? Dejará de aparecer y de recordarse, pero su historial se conserva.`
      )
    ) {
      return;
    }
    busyId = habit.id;
    actionError = null;
    try {
      await setHabitArchived(habit.id, archiving);
      await habitsStore.load();
    } catch (err) {
      actionError = err instanceof HabitApiError ? err.message : 'No se pudo actualizar el hábito.';
    } finally {
      busyId = null;
    }
  }
</script>

<main class="settings-page">
  <header class="settings-page__header">
    <h1>Ajustes de hábitos</h1>
    <a href="/habits">Volver a hábitos</a>
  </header>

  {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
  {#if $habitsStore.error}
    <p class="error" role="alert">{$habitsStore.error}</p>
  {:else if $habitsStore.loading && !$habitsStore.loaded}
    <p class="status">Cargando hábitos…</p>
  {:else if $habitsStore.habits.length === 0}
    <p class="status">Todavía no tienes hábitos.</p>
  {:else}
    {#snippet row(habit: Habit)}
      <li class="item">
        <div class="item__head">
          <strong>{habit.title}</strong>
          <span class="item__actions">
            <a href={`/habits/${habit.id}/edit`}>Configurar</a>
            <button
              type="button"
              disabled={busyId === habit.id}
              onclick={() => toggleArchived(habit)}
            >
              {habit.archived_at ? 'Restaurar' : 'Archivar'}
            </button>
          </span>
        </div>
        <p class="meta">
          {describeDays(habit.days_of_week)} · {HABIT_DAY_PART_LABEL[habit.day_part]} ·
          {habit.reminder_time
            ? `recordatorio ${habit.reminder_time.slice(0, 5)}`
            : 'sin recordatorio'}
          · adaptación {habit.adaptive ? 'activada' : 'desactivada'}
        </p>
        {#if habit.adaptive && !habit.archived_at}
          <p class="meta">Patrón por día (últimas semanas):</p>
          <ul class="pattern">
            {#each stats(habit) as s (s.weekday)}
              <li title={`${s.completed}/${s.scheduled} cumplidos · ${PLAN_LABEL[s.plan]}`}>
                <span>{WEEKDAY_SHORT[s.weekday]}</span>
                <span class={`plan plan--${s.plan}`}>{PLAN_SYMBOL[s.plan]}</span>
                <span class="count">{s.scheduled > 0 ? `${s.completed}/${s.scheduled}` : '–'}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/snippet}

    <ul class="items">
      {#each active as habit (habit.id)}{@render row(habit)}{/each}
    </ul>
    <p class="legend">● requerido · ◐ recordatorio especial · ○ opcional</p>

    {#if archived.length > 0}
      <h2>Archivados</h2>
      <ul class="items">
        {#each archived as habit (habit.id)}{@render row(habit)}{/each}
      </ul>
    {/if}
  {/if}
</main>

<style>
  .settings-page {
    max-width: 760px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .settings-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  h1,
  h2 {
    margin: 0;
  }
  .items,
  .pattern {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .items {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .item {
    padding: 0.9rem 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .item__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .item__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .item__actions a {
    color: #6fa8ff;
    text-decoration: none;
  }
  .item__actions button {
    min-height: 40px;
    padding: 0 0.8rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .meta,
  .legend,
  .status {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted, #a0a0b0);
  }
  .pattern {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .pattern li {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 2.2rem;
    font-size: 0.75rem;
  }
  .plan--REQUIRED {
    color: #2c9e5c;
  }
  .plan--REMINDER {
    color: #f0c419;
  }
  .plan--OPTIONAL {
    color: #a0a0b0;
  }
  .count {
    color: var(--text-muted, #a0a0b0);
  }
  .error {
    color: #e0574f;
  }
</style>
