<script lang="ts">
  import { onMount } from 'svelte';
  import { habitsStore } from '$lib/stores/habits';
  import { notificationsStore } from '$lib/stores/notifications';
  import { auth } from '$lib/stores/auth';
  import { userSkillsStore } from '$lib/stores/user-skills';
  import { completeHabit, HabitApiError } from '$lib/api/habits';
  import { habitDayInfo } from '$lib/utils/habit-adaptation';
  import { toLocalDateStr } from '$lib/utils/habit-schedule';
  import { HABIT_DAY_PART_ORDER, type Habit } from '$lib/types/habits';
  import HabitCard from '$lib/components/habits/HabitCard.svelte';

  let showAll = $state(false);
  let completingId = $state<string | null>(null);
  let actionError = $state<string | null>(null);
  let lastReward = $state<{ xp: number; coins: number; leveledUp: boolean } | null>(null);

  onMount(() => {
    void habitsStore.load();
    // A tab left open past midnight must switch to the new day.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && toLocalDateStr() !== $habitsStore.today) {
        void habitsStore.load();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  const entries = $derived(
    $habitsStore.habits
      .filter((h) => h.archived_at === null)
      .map((habit) => ({
        habit,
        info: habitDayInfo(
          habit,
          $habitsStore.schedules[habit.id] ?? [],
          $habitsStore.completed[habit.id] ?? [],
          $habitsStore.today
        )
      }))
      .sort(
        (a, b) =>
          HABIT_DAY_PART_ORDER[a.habit.day_part] - HABIT_DAY_PART_ORDER[b.habit.day_part] ||
          a.habit.title.localeCompare(b.habit.title)
      )
  );

  const todayEntries = $derived(entries.filter((e) => e.info.scheduledToday));
  const visible = $derived(showAll ? entries : todayEntries);
  const doneToday = $derived(todayEntries.filter((e) => e.info.doneToday).length);
  const todayLabel = $derived(
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  );

  async function handleComplete(habit: Habit) {
    completingId = habit.id;
    actionError = null;
    try {
      const result = await completeHabit(habit.id, $habitsStore.today);
      lastReward = {
        xp: result.xp_awarded,
        coins: result.coins_awarded,
        leveledUp: result.player_leveled_up
      };
      await Promise.all([
        habitsStore.load(),
        auth.refreshProfile(),
        userSkillsStore.load(),
        notificationsStore.refresh()
      ]);
    } catch (err) {
      actionError = err instanceof HabitApiError ? err.message : 'No se pudo completar el hábito.';
      // e.g. already completed from another device: show the real state.
      void habitsStore.load();
    } finally {
      completingId = null;
    }
  }
</script>

<main class="habits-page">
  <header class="habits-page__header">
    <h1>Hábitos</h1>
    <div class="habits-page__actions">
      <a class="secondary-link" href="/habits/settings">⚙ Ajustes</a>
      <a class="new-link" href="/habits/new">+ Nuevo hábito</a>
    </div>
  </header>

  <div class="toolbar">
    <p class="today">
      <strong>{todayLabel}</strong>
      {#if !showAll && todayEntries.length > 0}· {doneToday}/{todayEntries.length} cumplidos{/if}
    </p>
    <button
      type="button"
      class="toggle"
      aria-pressed={showAll}
      onclick={() => (showAll = !showAll)}
    >
      {showAll ? 'Mostrar solo hoy' : 'Mostrar todos los hábitos'}
    </button>
  </div>

  {#if lastReward}
    <div class="toast" role="status">
      +{lastReward.xp} XP · +{lastReward.coins} monedas
      {#if lastReward.leveledUp}· ¡Subiste de nivel!{/if}
      <button type="button" onclick={() => (lastReward = null)} aria-label="Cerrar">✕</button>
    </div>
  {/if}
  {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}

  {#if $habitsStore.error}
    <p class="error" role="alert">{$habitsStore.error}</p>
  {:else if $habitsStore.loading && !$habitsStore.loaded}
    <p class="status">Cargando hábitos…</p>
  {:else if entries.length === 0}
    <p class="status">Todavía no tienes hábitos. Crea el primero con «+ Nuevo hábito».</p>
  {:else if visible.length === 0}
    <p class="status">Hoy no tienes hábitos programados.</p>
  {:else}
    <ul class="list">
      {#each visible as entry (entry.habit.id)}
        <li>
          <HabitCard
            habit={entry.habit}
            info={entry.info}
            completing={completingId === entry.habit.id}
            onComplete={handleComplete}
          />
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .habits-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .habits-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .habits-page__header h1 {
    margin: 0;
  }
  .habits-page__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .new-link,
  .secondary-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.9rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-decoration: none;
  }
  .new-link {
    background: #4c6ef5;
    color: white;
  }
  .secondary-link {
    border: 1px solid var(--border, #2c2c3a);
    color: inherit;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .today {
    margin: 0;
    text-transform: capitalize;
  }
  .toggle {
    min-height: 44px;
    padding: 0 0.9rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border, #2c2c3a);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .toggle[aria-pressed='true'] {
    background: #4c6ef5;
    border-color: #4c6ef5;
    color: white;
  }
  .list {
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
</style>
