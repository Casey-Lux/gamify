<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { skills, areas } from '$lib/stores/catalog';
  import { fetchHabitById, updateHabit, HabitApiError } from '$lib/api/habits';
  import type { Habit } from '$lib/types/habits';
  import { isDaily } from '$lib/utils/habit-schedule';
  import HabitForm, { type HabitFormValues } from '$lib/components/habits/HabitForm.svelte';

  const habitId = $derived(page.params.id ?? '');

  let habit = $state<Habit | null>(null);
  let loading = $state(true);
  let loadError = $state<string | null>(null);
  let submitting = $state(false);
  let formError = $state<string | null>(null);

  onMount(async () => {
    try {
      habit = await fetchHabitById(habitId);
    } catch (err) {
      loadError = err instanceof HabitApiError ? err.message : 'No se pudo cargar el hábito.';
    } finally {
      loading = false;
    }
  });

  const initial = $derived.by((): HabitFormValues | null => {
    if (!habit) return null;
    return {
      title: habit.title,
      description: habit.description ?? '',
      skillId: habit.skill_id,
      areaId: habit.area_id ?? '',
      difficulty: habit.difficulty,
      xpReward: habit.xp_reward,
      coinReward: habit.coin_reward,
      daily: isDaily(habit.days_of_week),
      days: [...habit.days_of_week],
      dayPart: habit.day_part,
      reminderTime: habit.reminder_time ? habit.reminder_time.slice(0, 5) : '',
      adaptive: habit.adaptive
    };
  });

  async function handleSubmit(values: HabitFormValues) {
    if (!habit) return;
    submitting = true;
    formError = null;
    try {
      await updateHabit(habit, {
        ...values,
        areaId: values.areaId.length > 0 ? values.areaId : null
      });
      await goto('/habits');
    } catch (err) {
      formError = err instanceof HabitApiError ? err.message : 'No se pudo guardar el hábito.';
    } finally {
      submitting = false;
    }
  }
</script>

<main class="habit-page">
  <header class="habit-page__header">
    <h1>Configurar hábito</h1>
    <a href="/habits">Volver a hábitos</a>
  </header>

  {#if loading}
    <p class="status">Cargando hábito…</p>
  {:else if loadError}
    <p class="error" role="alert">{loadError}</p>
  {:else if !habit}
    <p class="status">No se encontró el hábito o no tienes acceso a él.</p>
  {:else if initial}
    <p class="status">
      Los cambios de frecuencia se aplican desde hoy: tu historial anterior no se modifica.
    </p>
    <HabitForm
      {initial}
      skills={$skills}
      areas={$areas}
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
    margin: 0;
    color: var(--text-muted, #a0a0b0);
  }
  .error {
    color: #e0574f;
  }
</style>
