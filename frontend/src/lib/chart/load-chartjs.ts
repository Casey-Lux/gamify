let chartModulePromise: Promise<typeof import('chart.js/auto')> | null = null;

export function loadChartJs() {
  chartModulePromise ??= import('chart.js/auto');
  return chartModulePromise;
}
