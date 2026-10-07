<script lang="ts">
  import { onMount } from 'svelte';
  import type { ChartConfiguration } from 'chart.js';
  import { statisticsStore } from '$lib/stores/statistics';
  import { generateBuckets } from '$lib/utils/date-buckets';
  import {
    countByBucket,
    cumulativeByBucket,
    groupCount,
    sumByBucket
  } from '$lib/utils/statistics-aggregate';
  import { auth } from '$lib/stores/auth';
  import { skills } from '$lib/stores/catalog';
  import { fetchHabitCompletions, fetchHabits, fetchScheduleHistory } from '$lib/api/habits';
  import { buildHeatmap, heatmapStart } from '$lib/utils/habit-heatmap';
  import { toLocalDateStr } from '$lib/utils/habit-schedule';
  import type { Habit, ScheduleEntry } from '$lib/types/habits';
  import HabitHeatmap from '$lib/components/statistics/HabitHeatmap.svelte';
  import ChartCanvas from '$lib/components/statistics/ChartCanvas.svelte';
  import StatSummaryCards from '$lib/components/statistics/StatSummaryCards.svelte';
  import CachedNotice from '$lib/components/layout/CachedNotice.svelte';
  import type { StatGranularity } from '$lib/types/statistics';

  const GRANULARITIES: { value: StatGranularity; label: string }[] = [
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' }
  ];

  // Only one chart is shown at a time; this selector switches between ALL
  // of them (the six original ones plus the two new ones).
  type ChartId =
    | 'missions'
    | 'xp'
    | 'coins'
    | 'skill-activity'
    | 'area-activity'
    | 'skill-radar'
    | 'xp-cumulative'
    | 'habit-heatmap';

  const CHART_OPTIONS: { id: ChartId; label: string }[] = [
    { id: 'missions', label: 'Misiones completadas' },
    { id: 'xp', label: 'XP ganada' },
    { id: 'coins', label: 'Monedas ganadas / gastadas' },
    { id: 'skill-activity', label: 'Actividad por skill' },
    { id: 'area-activity', label: 'Actividad por área' },
    { id: 'skill-radar', label: 'Nivel por skill' },
    { id: 'xp-cumulative', label: 'XP acumulada' },
    { id: 'habit-heatmap', label: 'Cumplimiento de hábitos' }
  ];

  let selectedChart = $state<ChartId>('missions');
  /** 'all' = XP general, otherwise a skill id. */
  let xpScope = $state<string>('all');

  // Habit heatmap data (own window, independent of the día/semana/mes toggle).
  const HEATMAP_WEEKS = 26;
  let habits = $state<Habit[]>([]);
  let habitsLoaded = $state(false);
  let heatmapHabitId = $state('');
  let heatmapSchedule = $state<ScheduleEntry[]>([]);
  let heatmapCompleted = $state<string[]>([]);
  let heatmapLoading = $state(false);
  let heatmapError = $state<string | null>(null);
  let heatmapToken = 0;

  onMount(() => {
    void statisticsStore.load('day');
  });

  $effect(() => {
    if (selectedChart !== 'habit-heatmap' || habitsLoaded) return;
    void fetchHabits()
      .then((list) => {
        habits = list;
        if (!heatmapHabitId) {
          heatmapHabitId = (list.find((h) => h.archived_at === null) ?? list[0])?.id ?? '';
        }
      })
      .catch(() => (heatmapError = 'No se pudieron cargar los hábitos.'))
      .finally(() => (habitsLoaded = true));
  });

  $effect(() => {
    const habitId = heatmapHabitId;
    if (selectedChart !== 'habit-heatmap' || !habitId) return;
    const token = ++heatmapToken;
    heatmapLoading = true;
    heatmapError = null;
    const since = heatmapStart(toLocalDateStr(), HEATMAP_WEEKS);
    void Promise.all([fetchScheduleHistory([habitId]), fetchHabitCompletions(since, habitId)])
      .then(([schedules, completed]) => {
        if (token !== heatmapToken) return;
        heatmapSchedule = schedules[habitId] ?? [];
        heatmapCompleted = completed[habitId] ?? [];
      })
      .catch(() => {
        if (token === heatmapToken) heatmapError = 'No se pudo cargar el cumplimiento del hábito.';
      })
      .finally(() => {
        if (token === heatmapToken) heatmapLoading = false;
      });
  });

  const heatmap = $derived(
    buildHeatmap(toLocalDateStr(), HEATMAP_WEEKS, heatmapSchedule, heatmapCompleted)
  );

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

  // Accumulated XP. Baseline = XP held right now minus what the loaded window
  // contributed, i.e. everything earned before the first bucket (the totals
  // come from profiles.total_xp / player_skills.xp, never recomputed).
  const xpScopeEntries = $derived(
    $statisticsStore.completions
      .filter((c) => xpScope === 'all' || c.skill_id === xpScope)
      .map((c) => ({ date: c.completed_at, value: c.xp_awarded }))
  );
  const xpScopeCurrent = $derived(
    xpScope === 'all'
      ? ($auth.profile?.total_xp ?? xpAccumulated)
      : ($statisticsStore.skillProgress.find((s) => s.skill_id === xpScope)?.xp ?? 0)
  );
  const xpScopeLabel = $derived(
    xpScope === 'all'
      ? 'XP acumulada (general)'
      : `XP acumulada · ${$skills.find((s) => s.id === xpScope)?.name ?? 'skill'}`
  );
  const xpCumulativeChartConfig = $derived<ChartConfiguration>({
    type: 'line',
    data: {
      labels: bucketLabels,
      datasets: [
        {
          label: xpScopeLabel,
          data: cumulativeByBucket(
            buckets,
            xpScopeEntries,
            Math.max(0, xpScopeCurrent - xpScopeEntries.reduce((sum, e) => sum + e.value, 0))
          ),
          borderColor: '#2c9e5c',
          backgroundColor: '#2c9e5c33',
          fill: true,
          tension: 0.25
        }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
  });
</script>

<main class="statistics-page">
  <header class="statistics-page__header">
    <h1>Estadísticas</h1>
    <div
      class="granularity-toggle"
      role="group"
      aria-label="Agrupar por"
      hidden={selectedChart === 'habit-heatmap'}
    >
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

    <div class="chart-controls">
      <label>
        Estadística
        <select bind:value={selectedChart}>
          {#each CHART_OPTIONS as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>

      {#if selectedChart === 'xp-cumulative'}
        <label>
          XP de
          <select bind:value={xpScope}>
            <option value="all">General</option>
            {#each $skills as skill (skill.id)}
              <option value={skill.id}>{skill.name}</option>
            {/each}
          </select>
        </label>
      {:else if selectedChart === 'habit-heatmap' && habits.length > 0}
        <label>
          Hábito
          <select bind:value={heatmapHabitId}>
            {#each habits as habit (habit.id)}
              <option value={habit.id}>
                {habit.title}{habit.archived_at ? ' (archivado)' : ''}
              </option>
            {/each}
          </select>
        </label>
      {/if}
    </div>

    <div class="chart-stage">
      {#if selectedChart === 'habit-heatmap'}
        {#if heatmapError}
          <p class="error" role="alert">{heatmapError}</p>
        {:else if !habitsLoaded}
          <p class="status">Cargando hábitos…</p>
        {:else if habits.length === 0}
          <p class="status">Todavía no tienes hábitos. Crea uno en la sección Hábitos.</p>
        {:else if heatmapLoading}
          <p class="status">Cargando cumplimiento…</p>
        {:else}
          <HabitHeatmap title="Cumplimiento de hábitos" {heatmap} />
        {/if}
      {:else}
        <!-- {#key}: a new Chart.js instance per selection (chart types differ). -->
        {#key `${selectedChart}:${xpScope}`}
          {#if selectedChart === 'missions'}
            <ChartCanvas title="Misiones completadas" config={missionsChartConfig} />
          {:else if selectedChart === 'xp'}
            <ChartCanvas title="XP ganada" config={xpChartConfig} />
          {:else if selectedChart === 'coins'}
            <ChartCanvas title="Monedas ganadas / gastadas" config={coinsChartConfig} />
          {:else if selectedChart === 'skill-activity'}
            <ChartCanvas title="Actividad por skill" config={skillActivityChartConfig} />
          {:else if selectedChart === 'area-activity'}
            <ChartCanvas title="Actividad por área" config={areaActivityChartConfig} />
          {:else if selectedChart === 'skill-radar'}
            <ChartCanvas title="Nivel por skill" config={skillRadarChartConfig} />
          {:else if selectedChart === 'xp-cumulative'}
            <ChartCanvas title={xpScopeLabel} config={xpCumulativeChartConfig} />
          {/if}
        {/key}
      {/if}
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
  .granularity-toggle[hidden] {
    display: none;
  }
  .chart-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .chart-controls label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.85rem;
    min-width: 200px;
  }
  .chart-controls select {
    min-height: 44px;
    padding: 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid var(--border, #2c2c3a);
    background: var(--input-bg, #14141f);
    color: inherit;
    font-family: inherit;
    color-scheme: dark;
  }
  .chart-stage {
    min-width: 0;
  }
</style>
