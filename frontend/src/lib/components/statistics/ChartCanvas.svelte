<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { loadChartJs } from '$lib/chart/load-chartjs';
  import type { Chart, ChartConfiguration } from 'chart.js';

  interface Props {
    title: string;
    config: ChartConfiguration;
  }

  let { title, config }: Props = $props();

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let chartInstance: Chart | null = null;

  onMount(async () => {
    const { Chart: ChartCtor } = await loadChartJs();
    if (!canvasEl) return; // component was destroyed before the import resolved
    chartInstance = new ChartCtor(canvasEl, config);
  });

  // Re-applies new data/options in place (e.g. the user switches the
  // día/semana/mes granularity toggle) instead of tearing down and
  // recreating the Chart.js instance on every change.
  $effect(() => {
    if (!chartInstance) return;
    chartInstance.data = config.data;
    if (config.options) chartInstance.options = config.options;
    chartInstance.update();
  });

  onDestroy(() => {
    chartInstance?.destroy();
  });
</script>

<figure class="chart-card">
  <figcaption>{title}</figcaption>
  <div class="chart-card__canvas" role="img" aria-label={title}>
    <canvas bind:this={canvasEl}></canvas>
  </div>
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
  .chart-card__canvas {
    position: relative;
    height: 220px;
  }
</style>
