import { e as ensure_array_like, a as attr_class, s as store_get, u as unsubscribe_stores, d as derived } from "../../../chunks/index2.js";
import { e as escape_html, a as attr } from "../../../chunks/attributes.js";
import { w as writable } from "../../../chunks/index3.js";
import { a as fetchCompletions, b as fetchWalletTransactions, f as fetchSkillProgress, C as CachedNotice } from "../../../chunks/CachedNotice.js";
import { s as setCached, g as getCached } from "../../../chunks/db.js";
import { s as statisticsCacheKey } from "../../../chunks/keys.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import "clsx";
const LOOKBACK = { day: 30, week: 12, month: 12 };
function startOfDayUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function mondayOfWeekUTC(d) {
  const day = startOfDayUTC(d);
  const dow = day.getUTCDay();
  const diffFromMonday = (dow + 6) % 7;
  day.setUTCDate(day.getUTCDate() - diffFromMonday);
  return day;
}
function startOfMonthUTC(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function generateBuckets(granularity, now = /* @__PURE__ */ new Date()) {
  const count = LOOKBACK[granularity];
  const buckets = [];
  for (let i = count - 1; i >= 0; i--) {
    let start;
    let end;
    let label;
    if (granularity === "day") {
      start = startOfDayUTC(now);
      start.setUTCDate(start.getUTCDate() - i);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      label = start.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    } else if (granularity === "week") {
      const thisMonday = mondayOfWeekUTC(now);
      start = new Date(thisMonday);
      start.setUTCDate(start.getUTCDate() - i * 7);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      label = start.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
    } else {
      const thisMonth = startOfMonthUTC(now);
      start = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - i, 1));
      end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      label = start.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    }
    buckets.push({ key: start.toISOString(), label, start, end });
  }
  return buckets;
}
function findBucketIndex(buckets, dateIso) {
  const t = new Date(dateIso).getTime();
  return buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
}
function windowStartIso(granularity, now = /* @__PURE__ */ new Date()) {
  const buckets = generateBuckets(granularity, now);
  const first = buckets[0];
  return (first ?? { start: startOfDayUTC(now) }).start.toISOString();
}
const initialState = {
  granularity: "day",
  completions: [],
  walletTransactions: [],
  skillProgress: [],
  loading: false,
  error: null,
  fromCache: false,
  cachedAt: null
};
function createStatisticsStore() {
  const { subscribe, update, set } = writable(initialState);
  async function load(granularity) {
    update((s) => ({ ...s, granularity, loading: true, error: null }));
    const sinceIso = windowStartIso(granularity);
    const cacheKey = statisticsCacheKey(granularity);
    try {
      const [completions, walletTransactions, skillProgress] = await Promise.all([
        fetchCompletions(sinceIso),
        fetchWalletTransactions(sinceIso),
        fetchSkillProgress()
      ]);
      update((s) => ({
        ...s,
        completions,
        walletTransactions,
        skillProgress,
        loading: false,
        fromCache: false,
        cachedAt: null
      }));
      void setCached("statistics", cacheKey, {
        completions,
        walletTransactions,
        skillProgress
      });
    } catch {
      const cached = await getCached("statistics", cacheKey);
      if (cached) {
        update((s) => ({
          ...s,
          completions: cached.data.completions,
          walletTransactions: cached.data.walletTransactions,
          skillProgress: cached.data.skillProgress,
          loading: false,
          fromCache: true,
          cachedAt: cached.cachedAt
        }));
        return;
      }
      update((s) => ({
        ...s,
        loading: false,
        error: "No se pudieron cargar las estadísticas.",
        fromCache: false,
        cachedAt: null
      }));
    }
  }
  function setGranularity(granularity) {
    void load(granularity);
  }
  function reset() {
    set(initialState);
  }
  return { subscribe, load, setGranularity, reset };
}
const statisticsStore = createStatisticsStore();
function countByBucket(buckets, dates) {
  const counts = new Array(buckets.length).fill(0);
  for (const date of dates) {
    const idx = findBucketIndex(buckets, date);
    if (idx >= 0) counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts;
}
function sumByBucket(buckets, entries) {
  const sums = new Array(buckets.length).fill(0);
  for (const entry of entries) {
    const idx = findBucketIndex(buckets, entry.date);
    if (idx >= 0) sums[idx] = (sums[idx] ?? 0) + entry.value;
  }
  return sums;
}
function groupCount(rows, keyFn) {
  const counts = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
function ChartCanvas($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { title, config } = $$props;
    onDestroy(() => {
    });
    $$renderer2.push(`<figure class="chart-card svelte-c3bato"><figcaption class="svelte-c3bato">${escape_html(title)}</figcaption> <div class="chart-card__canvas svelte-c3bato" role="img"${attr("aria-label", title)}><canvas></canvas></div></figure>`);
  });
}
function StatSummaryCards($$renderer, $$props) {
  let { missionsCompleted, xpAccumulated } = $$props;
  $$renderer.push(`<div class="summary svelte-15de20t"><div class="summary__card svelte-15de20t"><span class="summary__value svelte-15de20t">${escape_html(missionsCompleted)}</span> <span class="summary__label svelte-15de20t">Misiones completadas</span></div> <div class="summary__card svelte-15de20t"><span class="summary__value svelte-15de20t">${escape_html(xpAccumulated)}</span> <span class="summary__label svelte-15de20t">XP acumulada</span></div></div>`);
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const GRANULARITIES = [
      { value: "day", label: "Día" },
      { value: "week", label: "Semana" },
      { value: "month", label: "Mes" }
    ];
    const buckets = derived(() => generateBuckets(store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).granularity));
    const bucketLabels = derived(() => buckets().map((b) => b.label));
    const completionsPerBucket = derived(() => countByBucket(buckets(), store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).completions.map((c) => c.completed_at)));
    const xpPerBucket = derived(() => sumByBucket(buckets(), store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).completions.map((c) => ({ date: c.completed_at, value: c.xp_awarded }))));
    const coinsEarnedPerBucket = derived(() => sumByBucket(buckets(), store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).walletTransactions.filter((t) => t.amount > 0).map((t) => ({ date: t.created_at, value: t.amount }))));
    const coinsSpentPerBucket = derived(() => sumByBucket(buckets(), store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).walletTransactions.filter((t) => t.amount < 0).map((t) => ({ date: t.created_at, value: -t.amount }))));
    const activityBySkill = derived(() => groupCount(store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).completions, (c) => c.skill_name));
    const activityByArea = derived(() => groupCount(store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).completions, (c) => c.area_name ?? "Sin área"));
    const missionsCompleted = derived(() => store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).completions.length);
    const xpAccumulated = derived(() => store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).completions.reduce((sum, c) => sum + c.xp_awarded, 0));
    const missionsChartConfig = derived(() => ({
      type: "bar",
      data: {
        labels: bucketLabels(),
        datasets: [
          {
            label: "Misiones completadas",
            data: completionsPerBucket(),
            backgroundColor: "#4c6ef5"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    }));
    const xpChartConfig = derived(() => ({
      type: "line",
      data: {
        labels: bucketLabels(),
        datasets: [
          {
            label: "XP ganada",
            data: xpPerBucket(),
            borderColor: "#6fa8ff",
            backgroundColor: "#6fa8ff33",
            fill: true,
            tension: 0.25
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    }));
    const coinsChartConfig = derived(() => ({
      type: "bar",
      data: {
        labels: bucketLabels(),
        datasets: [
          {
            label: "Monedas ganadas",
            data: coinsEarnedPerBucket(),
            backgroundColor: "#2c9e5c"
          },
          {
            label: "Monedas gastadas",
            data: coinsSpentPerBucket(),
            backgroundColor: "#e0574f"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } }
      }
    }));
    const skillActivityChartConfig = derived(() => ({
      type: "bar",
      data: {
        labels: [...activityBySkill().keys()],
        datasets: [
          {
            label: "Misiones por skill",
            data: [...activityBySkill().values()],
            backgroundColor: "#f0c419"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: { x: { beginAtZero: true } }
      }
    }));
    const areaActivityChartConfig = derived(() => ({
      type: "bar",
      data: {
        labels: [...activityByArea().keys()],
        datasets: [
          {
            label: "Misiones por área",
            data: [...activityByArea().values()],
            backgroundColor: "#b06fd6"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        scales: { x: { beginAtZero: true } }
      }
    }));
    const skillRadarChartConfig = derived(() => ({
      type: "radar",
      data: {
        labels: store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).skillProgress.map((s) => s.skill_name),
        datasets: [
          {
            label: "Nivel por skill",
            data: store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).skillProgress.map((s) => s.level),
            borderColor: "#4c6ef5",
            backgroundColor: "#4c6ef533"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { r: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    }));
    $$renderer2.push(`<main class="statistics-page svelte-d07ngg"><header class="statistics-page__header svelte-d07ngg"><h1 class="svelte-d07ngg">Estadísticas</h1> <div class="granularity-toggle svelte-d07ngg" role="group" aria-label="Agrupar por"><!--[-->`);
    const each_array = ensure_array_like(GRANULARITIES);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let g = each_array[$$index];
      $$renderer2.push(`<button type="button"${attr_class("svelte-d07ngg", void 0, {
        "active": store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).granularity === g.value
      })}>${escape_html(g.label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></header> `);
    if (store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).error) {
      $$renderer2.push(`<!--[0--><p class="error svelte-d07ngg" role="alert">${escape_html(store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).error)}</p>`);
    } else if (store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).loading) {
      $$renderer2.push(`<!--[1--><p class="status svelte-d07ngg">Cargando estadísticas…</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      if (store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).fromCache && store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).cachedAt) {
        $$renderer2.push("<!--[0-->");
        CachedNotice($$renderer2, {
          cachedAt: store_get($$store_subs ??= {}, "$statisticsStore", statisticsStore).cachedAt
        });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      StatSummaryCards($$renderer2, {
        missionsCompleted: missionsCompleted(),
        xpAccumulated: xpAccumulated()
      });
      $$renderer2.push(`<!----> <div class="charts-grid svelte-d07ngg">`);
      ChartCanvas($$renderer2, { title: "Misiones completadas", config: missionsChartConfig() });
      $$renderer2.push(`<!----> `);
      ChartCanvas($$renderer2, { title: "XP ganada", config: xpChartConfig() });
      $$renderer2.push(`<!----> `);
      ChartCanvas($$renderer2, {
        title: "Monedas ganadas / gastadas",
        config: coinsChartConfig()
      });
      $$renderer2.push(`<!----> `);
      ChartCanvas($$renderer2, {
        title: "Actividad por skill",
        config: skillActivityChartConfig()
      });
      $$renderer2.push(`<!----> `);
      ChartCanvas($$renderer2, {
        title: "Actividad por área",
        config: areaActivityChartConfig()
      });
      $$renderer2.push(`<!----> `);
      ChartCanvas($$renderer2, { title: "Nivel por skill", config: skillRadarChartConfig() });
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
