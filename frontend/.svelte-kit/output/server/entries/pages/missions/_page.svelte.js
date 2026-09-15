import { e as ensure_array_like, a as attr_class, d as derived, c as stringify, s as store_get, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { a as attr, e as escape_html } from "../../../chunks/attributes.js";
import { w as writable, g as get } from "../../../chunks/index3.js";
import { s as supabase } from "../../../chunks/client.js";
import { s as setCached, g as getCached } from "../../../chunks/db.js";
import { m as missionsCacheKey } from "../../../chunks/keys.js";
import { a as areas, s as skills, c as catalogFromCache, b as catalogCachedAt } from "../../../chunks/catalog.js";
import "../../../chunks/auth.js";
import "../../../chunks/user-skills.js";
import { D as DIFFICULTY_LABEL, f as formatDueDate, i as isOverdue } from "../../../chunks/format.js";
import { C as CachedNotice } from "../../../chunks/CachedNotice.js";
const EMPTY_MISSION_FILTERS = {
  status: "PENDING",
  areaId: null,
  skillId: null,
  difficulty: null,
  dueBefore: null,
  dueAfter: null,
  xpMin: null,
  xpMax: null,
  coinsMin: null,
  coinsMax: null,
  search: ""
};
const DEFAULT_MISSION_SORT = {
  field: "created_at",
  direction: "DESC"
};
const MISSION_PAGE_SIZE = 20;
class MissionApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "MissionApiError";
  }
}
async function fetchMissionsPage(filters, sort, page) {
  let query = supabase.from("missions").select(
    `
      id, workspace_id, created_by, assigned_to, skill_id, area_id, title,
      description, difficulty, xp_reward, coin_reward, due_at, completed_at,
      created_at, updated_at,
      skill:skills(id, name),
      area:areas(id, name),
      subtasks:mission_subtasks(id, mission_id, title, position, completed, completed_at, created_at, updated_at)
      `,
    { count: "exact" }
  );
  query = applyFilters(query, filters);
  query = applySort(query, sort);
  const from = page * MISSION_PAGE_SIZE;
  const to = from + MISSION_PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw new MissionApiError(error.message, error.code);
  const missions = data ?? [];
  const totalCount = count ?? missions.length;
  return {
    missions,
    totalCount,
    hasMore: from + missions.length < totalCount
  };
}
function applyFilters(query, filters) {
  if (filters.status === "PENDING") query = query.is("completed_at", null);
  if (filters.status === "COMPLETED") query = query.not("completed_at", "is", null);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.skillId) query = query.eq("skill_id", filters.skillId);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.dueAfter) query = query.gte("due_at", filters.dueAfter);
  if (filters.dueBefore) query = query.lte("due_at", filters.dueBefore);
  if (filters.xpMin !== null) query = query.gte("xp_reward", filters.xpMin);
  if (filters.xpMax !== null) query = query.lte("xp_reward", filters.xpMax);
  if (filters.coinsMin !== null) query = query.gte("coin_reward", filters.coinsMin);
  if (filters.coinsMax !== null) query = query.lte("coin_reward", filters.coinsMax);
  if (filters.search.trim().length > 0) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }
  return query;
}
function applySort(query, sort) {
  const ascending = sort.direction === "ASC";
  const nullsFirst = sort.field === "due_at" ? false : void 0;
  query = query.order(sort.field, { ascending, nullsFirst });
  query = query.order("id", { ascending: true });
  return query;
}
const initialState = {
  missions: [],
  filters: { ...EMPTY_MISSION_FILTERS },
  sort: { ...DEFAULT_MISSION_SORT },
  page: 0,
  totalCount: 0,
  hasMore: false,
  loading: false,
  error: null,
  fromCache: false,
  cachedAt: null
};
function createMissionsStore() {
  const { subscribe, update, set } = writable(initialState);
  async function load() {
    const state = get({ subscribe });
    update((s) => ({ ...s, loading: true, error: null }));
    const cacheKey = missionsCacheKey(state.filters, state.sort, state.page);
    try {
      const result = await fetchMissionsPage(state.filters, state.sort, state.page);
      update((s) => ({
        ...s,
        missions: result.missions,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        loading: false,
        fromCache: false,
        cachedAt: null
      }));
      void setCached("missions", cacheKey, result);
    } catch (err) {
      const cached = await getCached("missions", cacheKey);
      if (cached) {
        update((s) => ({
          ...s,
          missions: cached.data.missions,
          totalCount: cached.data.totalCount,
          hasMore: cached.data.hasMore,
          loading: false,
          fromCache: true,
          cachedAt: cached.cachedAt
        }));
        return;
      }
      const message = err instanceof MissionApiError ? err.message : "No se pudieron cargar las misiones.";
      update((s) => ({ ...s, loading: false, error: message, fromCache: false, cachedAt: null }));
    }
  }
  function setFilters(filters) {
    update((s) => ({ ...s, filters: { ...s.filters, ...filters }, page: 0 }));
    void load();
  }
  function clearFilters() {
    update((s) => ({ ...s, filters: { ...EMPTY_MISSION_FILTERS }, page: 0 }));
    void load();
  }
  function clearFilter(key) {
    update((s) => ({
      ...s,
      filters: { ...s.filters, [key]: EMPTY_MISSION_FILTERS[key] },
      page: 0
    }));
    void load();
  }
  function setSort(sort) {
    update((s) => ({ ...s, sort, page: 0 }));
    void load();
  }
  function nextPage() {
    update((s) => s.hasMore ? { ...s, page: s.page + 1 } : s);
    void load();
  }
  function previousPage() {
    update((s) => s.page > 0 ? { ...s, page: s.page - 1 } : s);
    void load();
  }
  function reset() {
    set(initialState);
  }
  return {
    subscribe,
    load,
    setFilters,
    clearFilters,
    clearFilter,
    setSort,
    nextPage,
    previousPage,
    reset
  };
}
const missionsStore = createMissionsStore();
function SubtaskList($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { subtasks, disabled } = $$props;
    const sorted = derived(() => [...subtasks].sort((a, b) => a.position - b.position));
    $$renderer2.push(`<ul class="subtask-list svelte-ogcnah"><!--[-->`);
    const each_array = ensure_array_like(sorted());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let subtask = each_array[$$index];
      $$renderer2.push(`<li><label class="svelte-ogcnah"><input type="checkbox"${attr("checked", subtask.completed, true)}${attr("disabled", disabled, true)} class="svelte-ogcnah"/> <span${attr_class("svelte-ogcnah", void 0, { "done": subtask.completed })}>${escape_html(subtask.title)}</span></label></li>`);
    }
    $$renderer2.push(`<!--]--></ul>`);
  });
}
function MissionCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { mission, completing } = $$props;
    const isCompleted = derived(() => mission.completed_at !== null);
    const overdue = derived(() => isOverdue(mission.due_at, mission.completed_at));
    const hasSubtasks = derived(() => mission.subtasks.length > 0);
    const allSubtasksDone = derived(() => mission.subtasks.every((t) => t.completed));
    const canComplete = derived(() => !isCompleted() && (!hasSubtasks() || allSubtasksDone()) && !completing);
    $$renderer2.push(`<article${attr_class("mission-card svelte-7w8c", void 0, { "completed": isCompleted(), "overdue": overdue() })}><header class="mission-card__header svelte-7w8c"><span${attr_class(`chip chip--difficulty-${stringify(mission.difficulty.toLowerCase())}`, "svelte-7w8c")}>${escape_html(DIFFICULTY_LABEL[mission.difficulty])}</span> `);
    if (overdue()) {
      $$renderer2.push(`<!--[0--><span class="chip chip--overdue svelte-7w8c">Vencida</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (isCompleted()) {
      $$renderer2.push(`<!--[0--><span class="chip chip--completed svelte-7w8c">Completada</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></header> <h3 class="mission-card__title svelte-7w8c">${escape_html(mission.title)}</h3> `);
    if (mission.description) {
      $$renderer2.push(`<!--[0--><p class="mission-card__description svelte-7w8c">${escape_html(mission.description)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <dl class="mission-card__meta svelte-7w8c">`);
    if (mission.skill) {
      $$renderer2.push(`<!--[0--><div class="svelte-7w8c"><dt class="svelte-7w8c">Skill</dt> <dd class="svelte-7w8c">${escape_html(mission.skill.name)}</dd></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (mission.area) {
      $$renderer2.push(`<!--[0--><div class="svelte-7w8c"><dt class="svelte-7w8c">Área</dt> <dd class="svelte-7w8c">${escape_html(mission.area.name)}</dd></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="svelte-7w8c"><dt class="svelte-7w8c">Vence</dt> <dd class="svelte-7w8c">${escape_html(formatDueDate(mission.due_at))}</dd></div></dl> <div class="mission-card__rewards svelte-7w8c"><span class="reward reward--xp svelte-7w8c">+${escape_html(mission.xp_reward)} XP</span> <span class="reward reward--coins svelte-7w8c">+${escape_html(mission.coin_reward)} monedas</span></div> `);
    if (hasSubtasks()) {
      $$renderer2.push("<!--[0-->");
      SubtaskList($$renderer2, {
        subtasks: mission.subtasks,
        disabled: isCompleted()
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (!isCompleted()) {
      $$renderer2.push(`<!--[0--><button class="mission-card__complete svelte-7w8c" type="button"${attr("disabled", !canComplete(), true)}>${escape_html(completing ? "Completando…" : "Completar misión")}</button> `);
      if (hasSubtasks() && !allSubtasksDone()) {
        $$renderer2.push(`<!--[0--><p class="mission-card__hint svelte-7w8c">Completa todas las submisiones para poder finalizar.</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]-->`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></article>`);
  });
}
function MissionFiltersPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { filters, skills: skills2, areas: areas2, onChange } = $$props;
    const difficulties = ["EASY", "MEDIUM", "HARD"];
    const activeChips = derived(() => [
      filters.status !== "PENDING" && { key: "status", label: `Estado: ${filters.status}` },
      filters.areaId && {
        key: "areaId",
        label: `Área: ${areas2.find((a) => a.id === filters.areaId)?.name ?? ""}`
      },
      filters.skillId && {
        key: "skillId",
        label: `Skill: ${skills2.find((s) => s.id === filters.skillId)?.name ?? ""}`
      },
      filters.difficulty && {
        key: "difficulty",
        label: `Dificultad: ${DIFFICULTY_LABEL[filters.difficulty]}`
      },
      filters.dueAfter && { key: "dueAfter", label: `Desde: ${filters.dueAfter}` },
      filters.dueBefore && { key: "dueBefore", label: `Hasta: ${filters.dueBefore}` },
      filters.xpMin !== null && { key: "xpMin", label: `XP ≥ ${filters.xpMin}` },
      filters.xpMax !== null && { key: "xpMax", label: `XP ≤ ${filters.xpMax}` },
      filters.coinsMin !== null && { key: "coinsMin", label: `Monedas ≥ ${filters.coinsMin}` },
      filters.coinsMax !== null && { key: "coinsMax", label: `Monedas ≤ ${filters.coinsMax}` },
      filters.search.trim() !== "" && { key: "search", label: `"${filters.search}"` }
    ].filter((c) => c !== false));
    $$renderer2.push(`<section class="filters svelte-3fdih3" aria-label="Filtros de misiones"><div class="filters__row svelte-3fdih3"><input type="search" placeholder="Buscar por título…"${attr("value", filters.search)} class="svelte-3fdih3"/> `);
    $$renderer2.select(
      {
        value: filters.status,
        onchange: (e) => onChange({ status: e.currentTarget.value }),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "ALL" }, ($$renderer4) => {
          $$renderer4.push(`Todas`);
        });
        $$renderer3.option({ value: "PENDING" }, ($$renderer4) => {
          $$renderer4.push(`Pendientes`);
        });
        $$renderer3.option({ value: "COMPLETED" }, ($$renderer4) => {
          $$renderer4.push(`Completadas`);
        });
      },
      "svelte-3fdih3"
    );
    $$renderer2.push(` `);
    $$renderer2.select(
      {
        value: filters.areaId ?? "",
        onchange: (e) => onChange({ areaId: e.currentTarget.value || null }),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Todas las áreas`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(areas2);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let area = each_array[$$index];
          $$renderer3.option({ value: area.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(area.name)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-3fdih3"
    );
    $$renderer2.push(` `);
    $$renderer2.select(
      {
        value: filters.skillId ?? "",
        onchange: (e) => onChange({ skillId: e.currentTarget.value || null }),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Todas las skills`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_1 = ensure_array_like(skills2);
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let skill = each_array_1[$$index_1];
          $$renderer3.option({ value: skill.id }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(skill.name)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-3fdih3"
    );
    $$renderer2.push(` `);
    $$renderer2.select(
      {
        value: filters.difficulty ?? "",
        onchange: (e) => onChange({ difficulty: e.currentTarget.value || null }),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "" }, ($$renderer4) => {
          $$renderer4.push(`Toda dificultad`);
        });
        $$renderer3.push(`<!--[-->`);
        const each_array_2 = ensure_array_like(difficulties);
        for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
          let d = each_array_2[$$index_2];
          $$renderer3.option({ value: d }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(DIFFICULTY_LABEL[d])}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-3fdih3"
    );
    $$renderer2.push(`</div> <div class="filters__row svelte-3fdih3"><label class="range-field svelte-3fdih3">XP mín. <input type="number" min="0"${attr("value", filters.xpMin ?? "")} class="svelte-3fdih3"/></label> <label class="range-field svelte-3fdih3">XP máx. <input type="number" min="0"${attr("value", filters.xpMax ?? "")} class="svelte-3fdih3"/></label> <label class="range-field svelte-3fdih3">Monedas mín. <input type="number" min="0"${attr("value", filters.coinsMin ?? "")} class="svelte-3fdih3"/></label> <label class="range-field svelte-3fdih3">Monedas máx. <input type="number" min="0"${attr("value", filters.coinsMax ?? "")} class="svelte-3fdih3"/></label> <label class="range-field svelte-3fdih3">Vence desde <input type="date"${attr("value", filters.dueAfter ?? "")} class="svelte-3fdih3"/></label> <label class="range-field svelte-3fdih3">Vence hasta <input type="date"${attr("value", filters.dueBefore ?? "")} class="svelte-3fdih3"/></label></div> `);
    if (activeChips().length > 0) {
      $$renderer2.push(`<!--[0--><div class="filters__chips svelte-3fdih3"><!--[-->`);
      const each_array_3 = ensure_array_like(activeChips());
      for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
        let chip = each_array_3[$$index_3];
        $$renderer2.push(`<button type="button" class="chip-remove svelte-3fdih3">${escape_html(chip.label)} ✕</button>`);
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="filters__actions svelte-3fdih3"><button type="button" class="svelte-3fdih3">Limpiar todos los filtros</button></div></section>`);
  });
}
function MissionSortControl($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { sort, onChange } = $$props;
    const fields = [
      { value: "created_at", label: "Fecha de creación" },
      { value: "updated_at", label: "Última actualización" },
      { value: "due_at", label: "Fecha límite" },
      { value: "xp_reward", label: "XP" },
      { value: "coin_reward", label: "Monedas" },
      { value: "difficulty", label: "Dificultad" }
    ];
    $$renderer2.push(`<div class="sort-control svelte-mor4sj" aria-label="Ordenamiento de misiones">`);
    $$renderer2.select(
      {
        value: sort.field,
        onchange: (e) => onChange({ ...sort, field: e.currentTarget.value }),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(fields);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let f = each_array[$$index];
          $$renderer3.option({ value: f.value }, ($$renderer4) => {
            $$renderer4.push(`${escape_html(f.label)}`);
          });
        }
        $$renderer3.push(`<!--]-->`);
      },
      "svelte-mor4sj"
    );
    $$renderer2.push(` `);
    $$renderer2.select(
      {
        value: sort.direction,
        onchange: (e) => onChange({ ...sort, direction: e.currentTarget.value }),
        class: ""
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "ASC" }, ($$renderer4) => {
          $$renderer4.push(`Ascendente`);
        });
        $$renderer3.option({ value: "DESC" }, ($$renderer4) => {
          $$renderer4.push(`Descendente`);
        });
      },
      "svelte-mor4sj"
    );
    $$renderer2.push(`</div>`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let completingId = null;
    const from = derived(() => store_get($$store_subs ??= {}, "$missionsStore", missionsStore).page * MISSION_PAGE_SIZE + 1);
    const to = derived(() => Math.min(store_get($$store_subs ??= {}, "$missionsStore", missionsStore).page * MISSION_PAGE_SIZE + store_get($$store_subs ??= {}, "$missionsStore", missionsStore).missions.length, store_get($$store_subs ??= {}, "$missionsStore", missionsStore).totalCount));
    $$renderer2.push(`<main class="missions-page svelte-1iyw2is"><header class="missions-page__header svelte-1iyw2is"><h1 class="svelte-1iyw2is">Misiones</h1> <div class="missions-page__header-actions svelte-1iyw2is"><a class="new-mission-link svelte-1iyw2is" href="/missions/new">+ Nueva misión</a> `);
    MissionSortControl($$renderer2, {
      sort: store_get($$store_subs ??= {}, "$missionsStore", missionsStore).sort,
      onChange: missionsStore.setSort
    });
    $$renderer2.push(`<!----></div></header> `);
    MissionFiltersPanel($$renderer2, {
      filters: store_get($$store_subs ??= {}, "$missionsStore", missionsStore).filters,
      skills: store_get($$store_subs ??= {}, "$skills", skills),
      areas: store_get($$store_subs ??= {}, "$areas", areas),
      onChange: missionsStore.setFilters,
      onClearAll: missionsStore.clearFilters,
      onClearOne: missionsStore.clearFilter
    });
    $$renderer2.push(`<!----> `);
    if (store_get($$store_subs ??= {}, "$missionsStore", missionsStore).fromCache && store_get($$store_subs ??= {}, "$missionsStore", missionsStore).cachedAt) {
      $$renderer2.push("<!--[0-->");
      CachedNotice($$renderer2, {
        cachedAt: store_get($$store_subs ??= {}, "$missionsStore", missionsStore).cachedAt
      });
    } else if (store_get($$store_subs ??= {}, "$catalogFromCache", catalogFromCache) && store_get($$store_subs ??= {}, "$catalogCachedAt", catalogCachedAt)) {
      $$renderer2.push("<!--[1-->");
      CachedNotice($$renderer2, {
        cachedAt: store_get($$store_subs ??= {}, "$catalogCachedAt", catalogCachedAt)
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (store_get($$store_subs ??= {}, "$missionsStore", missionsStore).error) {
      $$renderer2.push(`<!--[0--><p class="error svelte-1iyw2is" role="alert">${escape_html(store_get($$store_subs ??= {}, "$missionsStore", missionsStore).error)}</p>`);
    } else if (store_get($$store_subs ??= {}, "$missionsStore", missionsStore).loading) {
      $$renderer2.push(`<!--[1--><p class="status svelte-1iyw2is">Cargando misiones…</p>`);
    } else if (store_get($$store_subs ??= {}, "$missionsStore", missionsStore).missions.length === 0) {
      $$renderer2.push(`<!--[2--><p class="status svelte-1iyw2is">No hay misiones que coincidan con estos filtros.</p>`);
    } else {
      $$renderer2.push(`<!--[-1--><ul class="missions-list svelte-1iyw2is"><!--[-->`);
      const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$missionsStore", missionsStore).missions);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let mission = each_array[$$index];
        $$renderer2.push(`<li>`);
        MissionCard($$renderer2, {
          mission,
          completing: completingId === mission.id
        });
        $$renderer2.push(`<!----></li>`);
      }
      $$renderer2.push(`<!--]--></ul> <nav class="pagination svelte-1iyw2is" aria-label="Paginación de misiones"><button type="button"${attr("disabled", store_get($$store_subs ??= {}, "$missionsStore", missionsStore).page === 0, true)} class="svelte-1iyw2is">Anterior</button> <span>${escape_html(from())}–${escape_html(to())} de ${escape_html(store_get($$store_subs ??= {}, "$missionsStore", missionsStore).totalCount)}</span> <button type="button"${attr("disabled", !store_get($$store_subs ??= {}, "$missionsStore", missionsStore).hasMore, true)} class="svelte-1iyw2is">Siguiente</button></nav>`);
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
