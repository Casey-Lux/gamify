<script lang="ts" module>
  import type { MissionDifficulty } from '$lib/types/domain';
  import type { HabitDayPart } from '$lib/types/habits';

  export interface HabitFormValues {
    title: string;
    description: string;
    skillId: string;
    areaId: string;
    difficulty: MissionDifficulty;
    xpReward: number;
    coinReward: number;
    daily: boolean;
    days: number[];
    /** true = "X veces por semana" (no concrete days), false = by weekdays. */
    weekly: boolean;
    weeklyTarget: number;
    dayPart: HabitDayPart;
    reminderTime: string;
    adaptive: boolean;
  }
</script>

<script lang="ts">
  import type { Area, Skill } from '$lib/types/domain';
  import { ALL_WEEKDAYS, HABIT_DAY_PART_LABEL, WEEKDAY_LABEL } from '$lib/types/habits';
  import { DIFFICULTY_LABEL } from '$lib/utils/format';

  interface Props {
    initial: HabitFormValues;
    skills: Skill[];
    areas: Area[];
    /** Edit mode: the skill cannot change after creation. */
    lockSkill?: boolean;
    submitting: boolean;
    submitLabel: string;
    submittingLabel: string;
    error: string | null;
    onSubmit: (values: HabitFormValues) => void;
  }

  let {
    initial,
    skills,
    areas,
    lockSkill = false,
    submitting,
    submitLabel,
    submittingLabel,
    error,
    onSubmit
  }: Props = $props();

  // The form edits a local copy seeded once from `initial`.
  // svelte-ignore state_referenced_locally
  let values = $state<HabitFormValues>({ ...initial, days: [...initial.days] });
  // svelte-ignore state_referenced_locally
  let reminderEnabled = $state(initial.reminderTime !== '');

  $effect(() => {
    if (!values.skillId && skills[0]) values.skillId = skills[0].id;
  });

  function toggleDaily(checked: boolean) {
    values.daily = checked;
    // Leaving "Diario" with nothing selected would be invalid: start from
    // every day so the user just unticks the ones they don't want.
    if (!checked && values.days.length === 0) values.days = [...ALL_WEEKDAYS];
  }

  function toggleDay(day: number, checked: boolean) {
    values.days = checked
      ? [...new Set([...values.days, day])]
      : values.days.filter((d) => d !== day);
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    onSubmit({
      ...values,
      xpReward: Number(values.xpReward),
      coinReward: Number(values.coinReward),
      days: [...values.days],
      weeklyTarget: Number(values.weeklyTarget),
      reminderTime: reminderEnabled ? values.reminderTime : ''
    });
  }
</script>

<form class="card" onsubmit={handleSubmit}>
  <label>
    Título
    <input type="text" bind:value={values.title} required maxlength="120" />
  </label>

  <label>
    Descripción (opcional)
    <textarea bind:value={values.description} maxlength="2000" rows="3"></textarea>
  </label>

  <fieldset class="frequency">
    <legend>Frecuencia</legend>
    <div class="modes" role="radiogroup" aria-label="Tipo de frecuencia">
      <label class="check">
        <input
          type="radio"
          name="frequency-mode"
          checked={!values.weekly}
          onchange={() => (values.weekly = false)}
        />
        Días concretos
      </label>
      <label class="check">
        <input
          type="radio"
          name="frequency-mode"
          checked={values.weekly}
          onchange={() => (values.weekly = true)}
        />
        X veces por semana
      </label>
    </div>

    {#if values.weekly}
      <label>
        Veces por semana
        <input type="number" bind:value={values.weeklyTarget} min="1" max="7" step="1" required />
      </label>
      <p class="hint">
        No eliges días: la app decide cuáles te tocan según lo que ya cumpliste esta semana y los
        días en que sueles hacerlo, y te avisa solo esos días. Si ya llegaste a tu meta, no te
        recuerda más hasta la semana siguiente.
      </p>
    {:else}
      <label class="check">
        <input
          type="checkbox"
          checked={values.daily}
          onchange={(e) => toggleDaily(e.currentTarget.checked)}
        />
        Diario
      </label>
      <div class="days" role="group" aria-label="Días de la semana">
        {#each ALL_WEEKDAYS as day (day)}
          <label class="check day">
            <input
              type="checkbox"
              disabled={values.daily}
              checked={values.daily || values.days.includes(day)}
              onchange={(e) => toggleDay(day, e.currentTarget.checked)}
            />
            {WEEKDAY_LABEL[day]}
          </label>
        {/each}
      </div>
      {#if !values.daily && values.days.length === 0}
        <p class="hint">Elige al menos un día.</p>
      {/if}
    {/if}
  </fieldset>

  <div class="grid-2">
    <label>
      Skill
      <select bind:value={values.skillId} required disabled={lockSkill}>
        {#each skills as skill (skill.id)}
          <option value={skill.id}>{skill.name}</option>
        {/each}
      </select>
    </label>
    <label>
      Área (opcional)
      <select bind:value={values.areaId}>
        <option value="">Sin área</option>
        {#each areas as area (area.id)}
          <option value={area.id}>{area.name}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="grid-2">
    <label>
      Dificultad
      <select bind:value={values.difficulty}>
        {#each Object.entries(DIFFICULTY_LABEL) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
    <label>
      Momento del día
      <select bind:value={values.dayPart}>
        {#each Object.entries(HABIT_DAY_PART_LABEL) as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="grid-2">
    <label>
      Recompensa de XP (por cumplimiento)
      <input type="number" bind:value={values.xpReward} min="0" step="1" required />
    </label>
    <label>
      Recompensa de monedas
      <input type="number" bind:value={values.coinReward} min="0" step="1" required />
    </label>
  </div>

  <fieldset class="frequency">
    <legend>Recordatorio</legend>
    <label class="check">
      <input type="checkbox" bind:checked={reminderEnabled} />
      Recordarme este hábito
    </label>
    {#if reminderEnabled}
      <label>
        Hora
        <input type="time" bind:value={values.reminderTime} required />
      </label>
    {/if}
  </fieldset>

  <label class="check">
    <input type="checkbox" bind:checked={values.adaptive} />
    Adaptar la planificación a mi comportamiento
  </label>
  <p class="hint">
    Si casi nunca cumples el hábito un día concreto de la semana, ese día se marcará como opcional o
    con un recordatorio especial. Tu calendario y tu historial no se modifican.
  </p>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <button type="submit" disabled={submitting}>
    {submitting ? submittingLabel : submitLabel}
  </button>
</form>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
  }
  label.check {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    min-height: 44px;
  }
  label.check input {
    min-height: auto;
    width: 1.1rem;
    height: 1.1rem;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  @media (max-width: 480px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
  }
  .modes {
    display: flex;
    flex-wrap: wrap;
    column-gap: 1.25rem;
  }
  .days {
    display: flex;
    flex-wrap: wrap;
    column-gap: 1rem;
  }
  input:not([type='checkbox']):not([type='radio']),
  select,
  textarea {
    min-height: 44px;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
    font-family: inherit;
    color-scheme: dark;
  }
  textarea {
    min-height: auto;
    resize: vertical;
  }
  fieldset.frequency {
    border: 1px solid var(--border, #2c2c3a);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  legend {
    padding: 0 0.4rem;
    font-size: 0.85rem;
    color: var(--text-muted, #a0a0b0);
  }
  .hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-muted, #a0a0b0);
  }
  button[type='submit'] {
    align-self: flex-start;
    min-height: 44px;
    padding: 0.5rem 1.2rem;
    border-radius: 0.5rem;
    border: none;
    background: #4c6ef5;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }
  button[type='submit']:disabled {
    background: #3a3a4a;
    cursor: not-allowed;
  }
  .error {
    margin: 0;
    font-size: 0.85rem;
    color: #e0574f;
  }
</style>
