<script lang="ts">
  import type { Habit } from '$lib/types/habits';
  import { HABIT_DAY_PART_LABEL, WEEKDAY_LABEL } from '$lib/types/habits';
  import type { HabitDayInfo } from '$lib/utils/habit-adaptation';
  import { describeDays } from '$lib/utils/habit-schedule';
  import { DIFFICULTY_LABEL } from '$lib/utils/format';

  interface Props {
    habit: Habit;
    info: HabitDayInfo;
    completing: boolean;
    onComplete: (habit: Habit) => void;
  }

  let { habit, info, completing, onComplete }: Props = $props();

  const hint = $derived.by(() => {
    if (!habit.adaptive || info.plan === 'REQUIRED') return null;
    const day = WEEKDAY_LABEL[info.stat.weekday] ?? '';
    const base = `Has cumplido ${info.stat.completed} de ${info.stat.scheduled} ${day.toLowerCase()} recientes.`;
    return info.plan === 'OPTIONAL'
      ? `${base} Hoy no es obligatorio.`
      : `${base} Hoy te lo recordamos de forma especial.`;
  });
</script>

<article class="habit" class:done={info.doneToday}>
  <div class="habit__main">
    <h3>{habit.title}</h3>
    {#if habit.description}<p class="habit__desc">{habit.description}</p>{/if}
    <p class="habit__meta">
      {describeDays(habit.days_of_week)} · {HABIT_DAY_PART_LABEL[habit.day_part]}
      {#if habit.reminder_time}· ⏰ {habit.reminder_time.slice(0, 5)}{/if}
    </p>
    <p class="habit__meta">
      {habit.skill?.name ?? 'Skill'} · {DIFFICULTY_LABEL[habit.difficulty]} · +{habit.xp_reward} XP ·
      +{habit.coin_reward}
      monedas
    </p>
    <div class="badges">
      {#if info.doneToday}<span class="badge badge--done">Hecho hoy</span>{/if}
      {#if !info.scheduledToday && !info.doneToday}
        <span class="badge">No programado hoy</span>
      {/if}
      {#if info.scheduledToday && !info.doneToday && info.plan === 'OPTIONAL' && habit.adaptive}
        <span class="badge badge--optional">Opcional hoy</span>
      {/if}
      {#if info.scheduledToday && !info.doneToday && info.plan === 'REMINDER' && habit.adaptive}
        <span class="badge badge--reminder">Recordatorio especial</span>
      {/if}
    </div>
    {#if hint && !info.doneToday}<p class="habit__hint">{hint}</p>{/if}
  </div>
  <div class="habit__actions">
    <button
      type="button"
      class="complete"
      disabled={completing || info.doneToday}
      onclick={() => onComplete(habit)}
    >
      {info.doneToday ? '✓ Cumplido' : completing ? 'Guardando…' : 'Completar'}
    </button>
    <a class="config" href={`/habits/${habit.id}/edit`} aria-label={`Configurar ${habit.title}`}>
      ⚙ Configurar
    </a>
  </div>
</article>

<style>
  .habit {
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.9rem 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .habit.done {
    opacity: 0.75;
  }
  .habit__main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  h3 {
    margin: 0;
    font-size: 1rem;
  }
  p {
    margin: 0;
  }
  .habit__desc {
    font-size: 0.85rem;
  }
  .habit__meta,
  .habit__hint {
    font-size: 0.78rem;
    color: var(--text-muted, #a0a0b0);
  }
  .badges {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .badge {
    font-size: 0.72rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    border: 1px solid var(--border, #2c2c3a);
    color: var(--text-muted, #a0a0b0);
  }
  .badge--done {
    color: #2c9e5c;
    border-color: #2c9e5c;
  }
  .badge--optional {
    color: #a0a0b0;
  }
  .badge--reminder {
    color: #f0c419;
    border-color: #f0c419;
  }
  .habit__actions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.4rem;
    flex-shrink: 0;
  }
  .complete {
    min-height: 44px;
    padding: 0 1rem;
    border-radius: 0.5rem;
    border: none;
    background: #4c6ef5;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  .complete:disabled {
    background: #3a3a4a;
    cursor: not-allowed;
  }
  .config {
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    color: #6fa8ff;
    text-decoration: none;
  }
</style>
