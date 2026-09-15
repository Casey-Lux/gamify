<script lang="ts">
  import type { MissionWithRelations } from '$lib/types/domain';
  import { DIFFICULTY_LABEL, formatDueDate, isOverdue } from '$lib/utils/format';
  import SubtaskList from './SubtaskList.svelte';

  interface Props {
    mission: MissionWithRelations;
    completing: boolean;
    onComplete: (missionId: string) => void;
    onSubtaskToggle: (subtaskId: string, completed: boolean) => void;
  }

  let { mission, completing, onComplete, onSubtaskToggle }: Props = $props();

  const isCompleted = $derived(mission.completed_at !== null);
  const overdue = $derived(isOverdue(mission.due_at, mission.completed_at));
  const hasSubtasks = $derived(mission.subtasks.length > 0);
  // Spec section 10: the Complete button stays disabled while any subtask is
  // unchecked. The real gate is server-side (complete_mission RPC step 6);
  // this is UX convenience only.
  const allSubtasksDone = $derived(mission.subtasks.every((t) => t.completed));
  const canComplete = $derived(!isCompleted && (!hasSubtasks || allSubtasksDone) && !completing);
</script>

<article class="mission-card" class:completed={isCompleted} class:overdue>
  <header class="mission-card__header">
    <span class="chip chip--difficulty-{mission.difficulty.toLowerCase()}">
      {DIFFICULTY_LABEL[mission.difficulty]}
    </span>
    {#if overdue}
      <span class="chip chip--overdue">Vencida</span>
    {/if}
    {#if isCompleted}
      <span class="chip chip--completed">Completada</span>
    {/if}
  </header>

  <h3 class="mission-card__title">{mission.title}</h3>
  {#if mission.description}
    <p class="mission-card__description">{mission.description}</p>
  {/if}

  <dl class="mission-card__meta">
    {#if mission.skill}
      <div>
        <dt>Skill</dt>
        <dd>{mission.skill.name}</dd>
      </div>
    {/if}
    {#if mission.area}
      <div>
        <dt>Área</dt>
        <dd>{mission.area.name}</dd>
      </div>
    {/if}
    <div>
      <dt>Vence</dt>
      <dd>{formatDueDate(mission.due_at)}</dd>
    </div>
  </dl>

  <div class="mission-card__rewards">
    <span class="reward reward--xp">+{mission.xp_reward} XP</span>
    <span class="reward reward--coins">+{mission.coin_reward} monedas</span>
  </div>

  {#if hasSubtasks}
    <SubtaskList subtasks={mission.subtasks} disabled={isCompleted} {onSubtaskToggle} />
  {/if}

  {#if !isCompleted}
    <button
      class="mission-card__complete"
      type="button"
      disabled={!canComplete}
      onclick={() => onComplete(mission.id)}
    >
      {completing ? 'Completando…' : 'Completar misión'}
    </button>
    {#if hasSubtasks && !allSubtasksDone}
      <p class="mission-card__hint">Completa todas las submisiones para poder finalizar.</p>
    {/if}
  {/if}
</article>

<style>
  .mission-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .mission-card.completed {
    opacity: 0.6;
  }
  .mission-card.overdue:not(.completed) {
    border-color: var(--danger, #e0574f);
  }
  .mission-card__header {
    display: flex;
    gap: 0.5rem;
  }
  .chip {
    font-size: 0.75rem;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
    background: var(--chip-bg, #2c2c3a);
  }
  .chip--difficulty-easy {
    background: #2c5c3a;
  }
  .chip--difficulty-medium {
    background: #6b5a1e;
  }
  .chip--difficulty-hard {
    background: #6b2c2c;
  }
  .chip--overdue {
    background: #6b2c2c;
  }
  .chip--completed {
    background: #2c5c3a;
  }
  .mission-card__title {
    margin: 0;
    font-size: 1.05rem;
  }
  .mission-card__description {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-muted, #a0a0b0);
  }
  .mission-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 0;
    font-size: 0.85rem;
  }
  .mission-card__meta div {
    display: flex;
    gap: 0.25rem;
  }
  .mission-card__meta dt {
    color: var(--text-muted, #a0a0b0);
  }
  .mission-card__meta dd {
    margin: 0;
  }
  .mission-card__rewards {
    display: flex;
    gap: 0.75rem;
    font-weight: 600;
  }
  .reward--xp {
    color: #6fa8ff;
  }
  .reward--coins {
    color: #f0c419;
  }
  .mission-card__complete {
    margin-top: 0.5rem;
    padding: 0.6rem 1rem;
    border-radius: 0.5rem;
    border: none;
    background: var(--accent, #4c6ef5);
    color: white;
    font-weight: 600;
    cursor: pointer;
    min-height: 44px;
  }
  .mission-card__complete:disabled {
    background: var(--disabled, #3a3a4a);
    cursor: not-allowed;
  }
  .mission-card__hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-muted, #a0a0b0);
  }
</style>
