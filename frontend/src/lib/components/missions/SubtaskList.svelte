<script lang="ts">
  import type { MissionSubtask } from '$lib/types/domain';

  interface Props {
    subtasks: MissionSubtask[];
    disabled: boolean;
    onSubtaskToggle: (subtaskId: string, completed: boolean) => void;
  }

  let { subtasks, disabled, onSubtaskToggle }: Props = $props();

  const sorted = $derived([...subtasks].sort((a, b) => a.position - b.position));
</script>

<ul class="subtask-list">
  {#each sorted as subtask (subtask.id)}
    <li>
      <label>
        <input
          type="checkbox"
          checked={subtask.completed}
          {disabled}
          onchange={(e) => onSubtaskToggle(subtask.id, e.currentTarget.checked)}
        />
        <span class:done={subtask.completed}>{subtask.title}</span>
      </label>
    </li>
  {/each}
</ul>

<style>
  .subtask-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    min-height: 32px;
  }
  input[type='checkbox'] {
    width: 18px;
    height: 18px;
  }
  .done {
    text-decoration: line-through;
    color: var(--text-muted, #a0a0b0);
  }
</style>
