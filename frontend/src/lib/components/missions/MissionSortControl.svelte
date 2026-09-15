<script lang="ts">
  import type { MissionSort, MissionSortField, SortDirection } from '$lib/types/mission-query';

  interface Props {
    sort: MissionSort;
    onChange: (sort: MissionSort) => void;
  }

  let { sort, onChange }: Props = $props();

  const fields: { value: MissionSortField; label: string }[] = [
    { value: 'created_at', label: 'Fecha de creación' },
    { value: 'updated_at', label: 'Última actualización' },
    { value: 'due_at', label: 'Fecha límite' },
    { value: 'xp_reward', label: 'XP' },
    { value: 'coin_reward', label: 'Monedas' },
    { value: 'difficulty', label: 'Dificultad' }
  ];
</script>

<div class="sort-control" aria-label="Ordenamiento de misiones">
  <select
    value={sort.field}
    onchange={(e) => onChange({ ...sort, field: e.currentTarget.value as MissionSortField })}
  >
    {#each fields as f (f.value)}
      <option value={f.value}>{f.label}</option>
    {/each}
  </select>
  <select
    value={sort.direction}
    onchange={(e) => onChange({ ...sort, direction: e.currentTarget.value as SortDirection })}
  >
    <option value="ASC">Ascendente</option>
    <option value="DESC">Descendente</option>
  </select>
</div>

<style>
  .sort-control {
    display: flex;
    gap: 0.5rem;
  }
  select {
    min-height: 40px;
    padding: 0.3rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
  }
</style>
