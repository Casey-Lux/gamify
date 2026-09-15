<script lang="ts">
  interface Props {
    missionsCompleted: number;
    xpAccumulated: number;
  }

  let { missionsCompleted, xpAccumulated }: Props = $props();
</script>

<div class="summary">
  <div class="summary__card">
    <span class="summary__value">{missionsCompleted}</span>
    <span class="summary__label">Misiones completadas</span>
  </div>
  <div class="summary__card">
    <span class="summary__value">{xpAccumulated}</span>
    <span class="summary__label">XP acumulada</span>
  </div>
</div>

<style>
  .summary {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .summary__card {
    flex: 1;
    min-width: 140px;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .summary__value {
    font-size: 1.75rem;
    font-weight: 700;
  }
  .summary__label {
    font-size: 0.8rem;
    color: var(--text-muted, #a0a0b0);
  }
</style>
