<script lang="ts">
  import { onMount } from 'svelte';
  import {
    backfillHabitCompletion,
    fetchHabitCompletions,
    fetchHabits,
    fetchScheduleHistory,
    HabitApiError,
    moveHabitCompletion
  } from '$lib/api/habits';
  import { auth } from '$lib/stores/auth';
  import { userSkillsStore } from '$lib/stores/user-skills';
  import { buildHeatmap, heatmapStart } from '$lib/utils/habit-heatmap';
  import { editableRange, firstScheduleDay, isEditableDate } from '$lib/utils/habit-history-edit';
  import { toLocalDateStr } from '$lib/utils/habit-schedule';
  import { versionOf } from '$lib/utils/freshness';
  import { HABIT_HISTORY_EDIT_DAYS, type Habit, type ScheduleEntry } from '$lib/types/habits';
  import HabitHeatmap from './HabitHeatmap.svelte';

  const HEATMAP_WEEKS = 26;

  interface HabitData {
    version: number;
    schedule: ScheduleEntry[];
    completed: string[];
  }
  let habitsCache: { version: number; list: Habit[] } | null = null;
  const dataCache = new Map<string, HabitData>();

  let habits = $state<Habit[]>([]);
  let habitsLoaded = $state(false);
  let habitId = $state('');
  let schedule = $state<ScheduleEntry[]>([]);
  let completed = $state<string[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let token = 0;

  let selectedDate = $state<string | null>(null);
  let moveTo = $state('');
  let busy = $state(false);
  let message = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  const today = $derived(toLocalDateStr());
  const habit = $derived(habits.find((h) => h.id === habitId) ?? null);
  const heatmap = $derived(buildHeatmap(today, HEATMAP_WEEKS, schedule, completed));
  const range = $derived(editableRange(today, firstScheduleDay(schedule)));
  const isDone = $derived(selectedDate !== null && completed.includes(selectedDate));
  const canEdit = $derived(
    habit !== null &&
      habit.archived_at === null &&
      selectedDate !== null &&
      isEditableDate(selectedDate, range)
  );

  function formatDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  onMount(async () => {
    try {
      if (!habitsCache || habitsCache.version !== versionOf('habits')) {
        habitsCache = { version: versionOf('habits'), list: await fetchHabits() };
      }
      habits = habitsCache.list;
      habitId = (habits.find((h) => h.archived_at === null) ?? habits[0])?.id ?? '';
    } catch {
      error = 'No se pudieron cargar los hábitos.';
    } finally {
      habitsLoaded = true;
    }
  });

  async function loadHabit(id: string, force = false) {
    const cached = dataCache.get(id);
    if (!force && cached && cached.version === versionOf('habits')) {
      schedule = cached.schedule;
      completed = cached.completed;
      return;
    }
    const mine = ++token;
    const version = versionOf('habits');
    loading = true;
    error = null;
    try {
      const since = heatmapStart(toLocalDateStr(), HEATMAP_WEEKS);
      const [schedules, done] = await Promise.all([
        fetchScheduleHistory([id]),
        fetchHabitCompletions(since, id)
      ]);
      if (mine !== token) return;
      schedule = schedules[id] ?? [];
      completed = done[id] ?? [];
      dataCache.set(id, { version, schedule, completed });
    } catch {
      if (mine === token) error = 'No se pudo cargar el cumplimiento del hábito.';
    } finally {
      if (mine === token) loading = false;
    }
  }

  $effect(() => {
    const id = habitId;
    selectedDate = null;
    message = null;
    actionError = null;
    if (id) void loadHabit(id);
  });

  function select(date: string) {
    selectedDate = date;
    moveTo = '';
    message = null;
    actionError = null;
  }

  async function run(action: () => Promise<unknown>, success: string, refreshEconomy: boolean) {
    if (!habit || busy) return;
    busy = true;
    message = null;
    actionError = null;
    try {
      await action();
      message = success;
      await loadHabit(habit.id, true);
      if (refreshEconomy) await Promise.all([auth.refreshProfile(), userSkillsStore.load()]);
      selectedDate = null;
    } catch (err) {
      actionError = err instanceof HabitApiError ? err.message : 'No se pudo guardar el cambio.';
      await loadHabit(habit.id, true);
    } finally {
      busy = false;
    }
  }

  function register() {
    if (!habit || !selectedDate) return;
    const id = habit.id;
    const date = selectedDate;
    void run(
      () => backfillHabitCompletion(id, date),
      `Registrado el ${formatDate(date)}. Recibiste la recompensa del hábito ahora.`,
      true
    );
  }

  function move() {
    if (!habit || !selectedDate || !moveTo) return;
    const id = habit.id;
    const from = selectedDate;
    const to = moveTo;
    void run(
      () => moveHabitCompletion(id, from, to),
      `Registro movido al ${formatDate(to)}.`,
      false
    );
  }
</script>

<section class="history">
  <header class="history__head">
    <h2>Historial de hábitos</h2>
    {#if habits.length > 0}
      <label>
        Hábito
        <select bind:value={habitId}>
          {#each habits as h (h.id)}
            <option value={h.id}>{h.title}{h.archived_at ? ' (archivado)' : ''}</option>
          {/each}
        </select>
      </label>
    {/if}
  </header>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {:else if !habitsLoaded}
    <p class="status">Cargando hábitos…</p>
  {:else if habits.length === 0}
    <p class="status">Todavía no tienes hábitos. Crea uno en la sección Hábitos.</p>
  {:else if loading && schedule.length === 0}
    <p class="status">Cargando cumplimiento…</p>
  {:else}
    <HabitHeatmap title="Cumplimiento" {heatmap} onSelect={select} {selectedDate} />

    <div class="editor" aria-live="polite">
      {#if message}<p class="ok">{message}</p>{/if}
      {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}

      {#if selectedDate === null}
        <p class="hint">
          ¿Olvidaste registrar un día? Toca una fecha para añadir o corregir su registro (últimos
          {HABIT_HISTORY_EDIT_DAYS} días).
        </p>
      {:else}
        <h3>{formatDate(selectedDate)}</h3>
        {#if habit?.archived_at}
          <p class="hint">Este hábito está archivado: no se puede editar su historial.</p>
        {:else if !canEdit}
          <p class="hint">
            {isDone ? 'Cumplido.' : 'Sin registro.'} Solo se pueden editar los últimos
            {HABIT_HISTORY_EDIT_DAYS} días y desde que existe el hábito.
          </p>
        {:else if isDone}
          <p class="hint">Cumplido. Si lo registraste en el día equivocado, puedes moverlo.</p>
          <div class="move">
            <label>
              Mover a
              <input type="date" bind:value={moveTo} min={range.from} max={range.to} />
            </label>
            <button
              type="button"
              disabled={busy || !moveTo || moveTo === selectedDate}
              onclick={move}
            >
              {busy ? 'Guardando…' : 'Mover registro'}
            </button>
          </div>
        {:else}
          <p class="hint">
            Sin registro. Al añadirlo recibirás ahora el XP y las monedas del hábito (con los bonus
            activos en este momento).
          </p>
          <button type="button" disabled={busy} onclick={register}>
            {busy ? 'Guardando…' : 'Registrar como cumplido'}
          </button>
        {/if}
      {/if}
    </div>
  {/if}
</section>

<style>
  .history {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
    min-width: 0;
  }
  .history__head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.75rem;
  }
  h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-muted, #a0a0b0);
  }
  h3 {
    margin: 0;
    font-size: 1rem;
    text-transform: capitalize;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  select,
  input[type='date'] {
    min-height: 44px;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
    font-family: inherit;
    color-scheme: dark;
  }
  .editor {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border, #2c2c3a);
  }
  .move {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 0.75rem;
  }
  button {
    min-height: 44px;
    padding: 0.5rem 1rem;
    border-radius: 0.4rem;
    border: none;
    background: #4c6ef5;
    color: white;
    font-family: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .hint,
  .status {
    margin: 0;
    font-size: 0.85rem;
    color: var(--text-muted, #a0a0b0);
  }
  .ok {
    margin: 0;
    color: #2c9e5c;
  }
  .error {
    margin: 0;
    color: #e0574f;
  }
</style>
