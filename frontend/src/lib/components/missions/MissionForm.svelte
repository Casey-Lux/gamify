<script lang="ts" module>
  import type { MissionDifficulty, MissionStatus } from '$lib/types/domain';
  import type { EditableSubtask } from '$lib/api/missions';

  export interface MissionFormValues {
    title: string;
    description: string;
    skillId: string;
    areaId: string;
    difficulty: MissionDifficulty;
    xpReward: number;
    coinReward: number;
    status: MissionStatus;
    /** `YYYY-MM-DD` or ''. */
    dueDate: string;
    /** `HH:MM` or '' (optional: '' means date only, no time assumed). */
    dueTime: string;
    assignedTo: string;
    subtasks: EditableSubtask[];
  }
</script>

<script lang="ts">
  import type { Area, Skill } from '$lib/types/domain';
  import type { WorkspaceMemberOption } from '$lib/api/workspace-members';
  import { DIFFICULTY_LABEL, MISSION_STATUS_LABEL } from '$lib/utils/format';

  interface Props {
    initial: MissionFormValues;
    skills: Skill[];
    areas: Area[];
    members: WorkspaceMemberOption[];
    isOwner: boolean;
    currentUserId: string | null;
    /** Edit mode: the skill cannot be changed after creation (0015 grants). */
    lockSkill?: boolean;
    submitting: boolean;
    submitLabel: string;
    submittingLabel: string;
    error: string | null;
    onSubmit: (values: MissionFormValues) => void;
  }

  let {
    initial,
    skills,
    areas,
    members,
    isOwner,
    currentUserId,
    lockSkill = false,
    submitting,
    submitLabel,
    submittingLabel,
    error,
    onSubmit
  }: Props = $props();

  // The form edits a local copy seeded once from `initial`.
  // svelte-ignore state_referenced_locally
  let values = $state<MissionFormValues>({
    ...initial,
    subtasks: initial.subtasks.map((t) => ({ ...t }))
  });

  // Default the skill once the catalog has loaded (create mode).
  $effect(() => {
    if (!values.skillId && skills[0]) values.skillId = skills[0].id;
  });
  $effect(() => {
    if (!values.assignedTo && currentUserId) values.assignedTo = currentUserId;
  });
  // A time only makes sense together with a date.
  $effect(() => {
    if (values.dueDate === '' && values.dueTime !== '') values.dueTime = '';
  });

  function addSubtaskRow() {
    values.subtasks = [...values.subtasks, { title: '' }];
  }
  function removeSubtaskRow(index: number) {
    values.subtasks = values.subtasks.filter((_, i) => i !== index);
  }

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    onSubmit({
      ...values,
      xpReward: Number(values.xpReward),
      coinReward: Number(values.coinReward),
      subtasks: values.subtasks.map((t) => ({ ...t }))
    });
  }
</script>

<form class="card" onsubmit={handleSubmit}>
  <label>
    Título
    <input type="text" bind:value={values.title} required maxlength="120" />
  </label>

  <label>
    Descripción
    <textarea bind:value={values.description} maxlength="2000" rows="3"></textarea>
  </label>

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
      Estado
      <select bind:value={values.status}>
        <option value="TODO">{MISSION_STATUS_LABEL.TODO}</option>
        <option value="DOING">{MISSION_STATUS_LABEL.DOING}</option>
      </select>
    </label>
  </div>

  <div class="grid-2">
    <label>
      Fecha límite (opcional)
      <!-- Native graphical calendar picker; no extra dependency. -->
      <input type="date" bind:value={values.dueDate} />
    </label>

    <label>
      Hora (opcional)
      <div class="time-row">
        <input
          type="time"
          bind:value={values.dueTime}
          disabled={values.dueDate === ''}
          aria-describedby="due-time-hint"
        />
        {#if values.dueTime !== ''}
          <button
            type="button"
            class="remove-btn"
            onclick={() => (values.dueTime = '')}
            aria-label="Quitar hora"
          >
            ✕
          </button>
        {/if}
      </div>
    </label>
  </div>
  <p class="hint" id="due-time-hint">Sin hora, la misión vence al terminar el día elegido.</p>

  <div class="grid-2">
    <label>
      Recompensa de XP
      <input type="number" bind:value={values.xpReward} min="0" step="1" required />
    </label>
    <label>
      Recompensa de monedas
      <input type="number" bind:value={values.coinReward} min="0" step="1" required />
    </label>
  </div>

  {#if isOwner && members.length > 0}
    <label>
      Asignar a
      <select bind:value={values.assignedTo}>
        {#each members as member (member.userId)}
          <option value={member.userId}>
            {member.userId === currentUserId ? `${member.displayName} (yo)` : member.displayName}
          </option>
        {/each}
      </select>
    </label>
  {/if}

  <fieldset class="subtasks">
    <legend>Submisiones (opcional)</legend>
    {#each values.subtasks as subtask, index (index)}
      <div class="subtask-row">
        <input
          type="text"
          bind:value={subtask.title}
          placeholder="Título de la submisión"
          maxlength="120"
        />
        <button
          type="button"
          class="remove-btn"
          onclick={() => removeSubtaskRow(index)}
          aria-label="Quitar submisión"
        >
          ✕
        </button>
      </div>
    {/each}
    <button type="button" class="add-btn" onclick={addSubtaskRow}>+ Añadir submisión</button>
  </fieldset>

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
  input,
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
  .time-row {
    display: flex;
    gap: 0.5rem;
  }
  .time-row input {
    flex: 1;
    min-width: 0;
  }
  .hint {
    margin: -0.4rem 0 0 0;
    font-size: 0.78rem;
    color: var(--text-muted, #a0a0b0);
  }
  fieldset.subtasks {
    border: 1px solid var(--border, #2c2c3a);
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  legend {
    padding: 0 0.4rem;
    font-size: 0.85rem;
    color: var(--text-muted, #a0a0b0);
  }
  .subtask-row {
    display: flex;
    gap: 0.5rem;
  }
  .subtask-row input {
    flex: 1;
  }
  .remove-btn,
  .add-btn {
    min-height: 44px;
    min-width: 44px;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .add-btn {
    align-self: flex-start;
    padding: 0 0.75rem;
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
