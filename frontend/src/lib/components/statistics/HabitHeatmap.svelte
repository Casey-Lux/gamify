<script lang="ts">
  import type { Heatmap, HeatmapState } from '$lib/utils/habit-heatmap';
  import { WEEKDAY_SHORT } from '$lib/types/habits';

  interface Props {
    title: string;
    heatmap: Heatmap;

    onSelect?: (date: string) => void;
    selectedDate?: string | null;
  }

  let { title, heatmap, onSelect, selectedDate = null }: Props = $props();

  const STATE_LABEL: Record<HeatmapState, string> = {
    done: 'cumplido',
    missed: 'no cumplido',
    pending: 'pendiente hoy',
    off: 'no programado',
    future: ''
  };
  const LEGEND: HeatmapState[] = ['done', 'missed', 'pending', 'off'];
  const summary = $derived(
    heatmap.mode === 'weekly'
      ? `${heatmap.completed} de ${heatmap.scheduled} veces de tu objetivo semanal cumplidas`
      : `${heatmap.completed} de ${heatmap.scheduled} días programados cumplidos`
  );
</script>

<figure class="chart-card">
  <figcaption>{title}</figcaption>
  <div class="scroll">
    <div class="grid" role="img" aria-label={`${title}: ${summary}`}>
      <div class="weekdays" aria-hidden="true">
        {#each [1, 2, 3, 4, 5, 6, 7] as d (d)}<span>{WEEKDAY_SHORT[d]}</span>{/each}
      </div>
      {#each heatmap.weeks as week (week[0]?.date)}
        <div class="week">
          {#each week as cell (cell.date)}
            {#if onSelect && cell.state !== 'future'}
              <button
                type="button"
                class={`cell cell--${cell.state} cell--button`}
                class:selected={selectedDate === cell.date}
                title={`${cell.date}: ${STATE_LABEL[cell.state]}`}
                aria-label={`${cell.date}: ${STATE_LABEL[cell.state]}`}
                aria-pressed={selectedDate === cell.date}
                onclick={() => onSelect(cell.date)}
              ></button>
            {:else}
              <span
                class={`cell cell--${cell.state}`}
                title={cell.state === 'future'
                  ? undefined
                  : `${cell.date}: ${STATE_LABEL[cell.state]}`}
              ></span>
            {/if}
          {/each}
        </div>
      {/each}
    </div>
  </div>
  <p class="summary">{summary}</p>
  <ul class="legend" aria-label="Leyenda">
    {#each LEGEND as state (state)}
      <li><span class={`cell cell--${state}`}></span>{STATE_LABEL[state]}</li>
    {/each}
  </ul>
</figure>

<style>
  .chart-card {
    margin: 0;
    padding: 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  figcaption {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted, #a0a0b0);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .scroll {
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }
  .grid {
    display: flex;
    gap: 3px;
    width: max-content;
  }
  .weekdays,
  .week {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .weekdays span {
    height: 14px;
    width: 12px;
    font-size: 0.6rem;
    line-height: 14px;
    color: var(--text-muted, #a0a0b0);
  }
  .cell {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 3px;
    box-sizing: border-box;
  }
  .cell--done {
    background: #2c9e5c;
  }
  .cell--missed {
    background: #5a2a30;
  }
  .cell--pending {
    background: transparent;
    border: 2px solid #4c6ef5;
  }
  .cell--off {
    background: #14141f;
    border: 1px solid var(--border, #2c2c3a);
  }
  .cell--button {
    padding: 0;
    cursor: pointer;
  }
  .cell--button.selected {
    outline: 2px solid #fff;
    outline-offset: 1px;
  }
  .cell--future {
    background: transparent;
  }
  .summary {
    margin: 0;
    font-size: 0.85rem;
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--text-muted, #a0a0b0);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
</style>
