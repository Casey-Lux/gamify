<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChartConfiguration } from 'chart.js';
  import { statisticsStore } from '$lib/stores/statistics';
  import { generateBuckets } from '$lib/utils/date-buckets';
  import { countByBucket, groupCount, sumByBucket } from '$lib/utils/statistics-aggregate';
  import ChartCanvas from '$lib/components/statistics/ChartCanvas.svelte';
  import StatSummaryCards from '$lib/components/statistics/StatSummaryCards.svelte';
  import CachedNotice from '$lib/components/layout/CachedNotice.svelte';
  import type { StatGranularity } from '$lib/types/statistics';

  const GRANULARITIES: { value: StatGranularity; label: string }[] = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' }
  ];

  onMount(() => {
    void statisticsStore.load('day');
  });

  const buckets = $derived(generateBuckets($statisticsStore.granularity));
  const bucketLabels = $derived(buckets.map((b) => b.label));

  const completionsPerBucket = $derived(
    countByBucket(
      buckets,
      $statisticsStore.completions.map((c) => c.completed_at)
    )
  );

  const xpPerBucket = $derived(
    sumByBucket(
      buckets,
      $statisticsStore.completions.map((c) => ({ date: c.completed_at, value: c.xp_awarded }))
    )
  );

  const coinsEarnedPerBucket = $derived(
    sumByBucket(
      buckets,
      $statisticsStore.walletTransactions
        .filter((t) => t.amount > 0)
        .map((t) => ({ date: t.created_at, value: t.amount }))
    )
  );

  const coinsSpentPerBucket = $derived(
    sumByBucket(
      buckets,
      $statisticsStore.walletTransactions
        .filter((t) => t.amount < 0)
        .map((t) => ({ date: t.created_at, value: -t.amount }))
    )
  );

  const activityBySkill = $derived(groupCount($statisticsStore.completions, (c) => c.skill_name));

  const activityByArea = $derived(
    groupCount($statisticsStore.completions, (c) => c.area_name ?? 'Sin área')
  );

  const missionsCompleted = $derived($statisticsStore.completions.length);
  const xpAccumulated = $derived(
    $statisticsStore.completions.reduce((sum, c) => sum + c.xp_awarded, 0)
  );

  const missionsChartConfig = $derived<ChartConfiguration>({
    type: 'bar',
    data: {
      labels: bucketLabels,
      datasets: [
        { label: 'Misiones completadas', data: completionsPerBucket, backgroundColor: '#4c6ef5' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  const xpChartConfig = $derived<ChartConfiguration>({
    type: 'line',
    data: {
      labels: bucketLabels,
      datasets: [
        {
          label: 'XP ganada',
          data: xpPerBucket,
          borderColor: '#6fa8ff',
          backgroundColor: '#6fa8ff33',
          fill: true,
          tension: 0.25
        }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  const coinsChartConfig = $derived<ChartConfiguration>({
    type: 'bar',
    data: {
      labels: bucketLabels,
      datasets: [
        { label: 'Monedas ganadas', data: coinsEarnedPerBucket, backgroundColor: '#2c9e5c' },
        { label: 'Monedas gastadas', data: coinsSpentPerBucket, backgroundColor: '#e0574f' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });

  const skillActivityChartConfig = $derived<ChartConfiguration>({
    type: 'bar',
    data: {
      labels: [...activityBySkill.keys()],
      datasets: [
        {
          label: 'Misiones por skill',
          data: [...activityBySkill.values()],
          backgroundColor: '#f0c419'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: { x: { beginAtZero: true } }
    }
  });

  const areaActivityChartConfig = $derived<ChartConfiguration>({
    type: 'bar',
    data: {
      labels: [...activityByArea.keys()],
      datasets: [
        {
          label: 'Misiones por área',
          data: [...activityByArea.values()],
          backgroundColor: '#b06fd6'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: { x: { beginAtZero: true } }
    }
  });

  const skillRadarChartConfig = $derived<ChartConfiguration>({
    type: 'radar',
    data: {
      labels: $statisticsStore.skillProgress.map((s) => s.skill_name),
      datasets: [
        {
          label: 'Nivel por skill',
          data: $statisticsStore.skillProgress.map((s) => s.level),
          borderColor: '#4c6ef5',
          backgroundColor: '#4c6ef533'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { r: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
</script>

<main class="statistics-page">
  <header class="statistics-page__header">
    <h1>Estadísticas</h1>
    <div class="granularity-toggle" role="group" aria-label="Agrupar por">
      {#each GRANULARITIES as g (g.value)}
        <button
          type="button"
          class:active={$statisticsStore.granularity === g.value}
          onclick={() => statisticsStore.setGranularity(g.value)}
        >
          {g.label}
        </button>
      {/each}
    </div>
  </header>

  {#if $statisticsStore.error}
    <p class="error" role="alert">{$statisticsStore.error}</p>
  {:else if $statisticsStore.loading}
    <p class="status">Cargando estadísticas…</p>
  {:else}
    {#if $statisticsStore.fromCache && $statisticsStore.cachedAt}
      <CachedNotice cachedAt={$statisticsStore.cachedAt} />
    {/if}

    <StatSummaryCards {missionsCompleted} {xpAccumulated} />

    <div class="charts-grid">
      <ChartCanvas title="Misiones completadas" config={missionsChartConfig} />
      <ChartCanvas title="XP ganada" config={xpChartConfig} />
      <ChartCanvas title="Monedas ganadas / gastadas" config={coinsChartConfig} />
      <ChartCanvas title="Actividad por skill" config={skillActivityChartConfig} />
      <ChartCanvas title="Actividad por área" config={areaActivityChartConfig} />
      <ChartCanvas title="Nivel por skill" config={skillRadarChartConfig} />
    </div>
  {/if}
</main>

<style>
  .statistics-page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1rem;
    padding-bottom: 5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .statistics-page__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .statistics-page__header h1 {
    margin: 0;
  }
  .granularity-toggle {
    display: flex;
    gap: 0.25rem;
  }
  .granularity-toggle button {
    min-height: 40px;
    padding: 0.4rem 0.9rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .granularity-toggle button.active {
    background: #4c6ef5;
    border-color: #4c6ef5;
    color: white;
  }
  .status {
    color: #a0a0b0;
  }
  .error {
    color: #e0574f;
  }
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 0.75rem;
  }
</style>
