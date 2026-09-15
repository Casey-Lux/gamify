/**
 * Spec section 23: "Cargar la librería de gráficos únicamente cuando
 * Statistics esté activa." `chart.js` is never statically imported anywhere
 * outside this file — every chart on the Statistics page calls
 * `loadChartJs()`, which dynamically `import()`s the library the first time
 * any chart actually mounts, then reuses that same in-flight/resolved
 * promise for every other chart on the page. Even though SvelteKit's own
 * route-based code-splitting would already keep this out of routes other
 * than /statistics, the dynamic import here makes that guarantee explicit
 * and independent of routing/bundler behaviour, as the spec literally asks.
 *
 * `chart.js/auto` (rather than importing + manually registering individual
 * controllers/scales) is the simplest option for the six chart types this
 * page needs (bar, line, radar) — not worth hand-picking a minimal build
 * for an MVP with one chart-heavy page.
 */
let chartModulePromise: Promise<typeof import('chart.js/auto')> | null = null;

export function loadChartJs() {
  chartModulePromise ??= import('chart.js/auto');
  return chartModulePromise;
}
