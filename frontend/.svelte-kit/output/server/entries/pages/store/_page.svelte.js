import { a as attr_class, d as derived, e as ensure_array_like, s as store_get, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { o as onDestroy } from "../../../chunks/index-server.js";
import { w as writable, g as get } from "../../../chunks/index3.js";
import { s as supabase } from "../../../chunks/client.js";
import "../../../chunks/workspace.js";
import { a as auth } from "../../../chunks/auth.js";
import { E as EFFECT_TYPE_LABEL, b as formatEffectValue, c as formatRemaining } from "../../../chunks/format.js";
import { e as escape_html, a as attr } from "../../../chunks/attributes.js";
class StoreApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "StoreApiError";
  }
}
async function fetchStoreItems(workspaceId) {
  const { data, error } = await supabase.from("store_items").select("*").eq("workspace_id", workspaceId).eq("active", true).order("price", { ascending: true });
  if (error) throw new StoreApiError(error.message, error.code);
  return data ?? [];
}
async function fetchActiveEffects() {
  const { data, error } = await supabase.from("consumable_activations").select("*").gt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).order("expires_at", { ascending: true });
  if (error) throw new StoreApiError(error.message, error.code);
  return data ?? [];
}
const PURCHASE_ERROR_MESSAGES = {
  GM001: "Debes iniciar sesión para comprar.",
  GM002: "No tienes acceso a este item.",
  GM003: "Este item ya no está disponible.",
  GM006: "No tienes suficientes monedas para este item.",
  GM007: "Este item está agotado por ahora."
};
function describePurchaseError(err) {
  if (err instanceof StoreApiError && err.code) {
    const mapped = PURCHASE_ERROR_MESSAGES[err.code];
    if (mapped) return mapped;
  }
  if (err instanceof StoreApiError) return err.message;
  return "No se pudo completar la compra.";
}
async function purchaseItem(itemId) {
  const { data, error } = await supabase.rpc("purchase_item", { p_item_id: itemId });
  if (error) throw new StoreApiError(error.message, error.code);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new StoreApiError("purchase_item returned no result");
  return row;
}
const initialState = {
  items: [],
  activeEffects: [],
  loading: false,
  error: null,
  purchasingId: null,
  purchaseError: null
};
function createStoreStore() {
  const { subscribe, update, set } = writable(initialState);
  async function load(workspaceId) {
    update((s) => ({ ...s, loading: true, error: null }));
    try {
      const [items, activeEffects] = await Promise.all([
        fetchStoreItems(workspaceId),
        fetchActiveEffects()
      ]);
      update((s) => ({ ...s, items, activeEffects, loading: false }));
    } catch {
      update((s) => ({ ...s, loading: false, error: "No se pudo cargar la tienda." }));
    }
  }
  async function refreshActiveEffects() {
    try {
      const activeEffects = await fetchActiveEffects();
      update((s) => ({ ...s, activeEffects }));
    } catch {
    }
  }
  async function purchase(itemId, workspaceId) {
    update((s) => ({ ...s, purchasingId: itemId, purchaseError: null }));
    try {
      const result = await purchaseItem(itemId);
      await load(workspaceId);
      update((s) => ({ ...s, purchasingId: null }));
      return result;
    } catch (err) {
      update((s) => ({ ...s, purchasingId: null, purchaseError: describePurchaseError(err) }));
      return null;
    }
  }
  function dismissPurchaseError() {
    update((s) => ({ ...s, purchaseError: null }));
  }
  function canAfford(item, coins) {
    return item.active && item.stock > 0 && coins >= item.price;
  }
  function reset() {
    set(initialState);
  }
  return {
    subscribe,
    load,
    refreshActiveEffects,
    purchase,
    dismissPurchaseError,
    canAfford,
    reset,
    get: () => get({ subscribe })
  };
}
const storeStore = createStoreStore();
function StoreItemCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { item, userCoins, purchasing } = $$props;
    const outOfStock = derived(() => item.stock <= 0);
    const insufficientFunds = derived(() => userCoins < item.price);
    const canBuy = derived(() => !outOfStock() && !insufficientFunds() && !purchasing);
    $$renderer2.push(`<article${attr_class("store-item svelte-1y428ge", void 0, { "out-of-stock": outOfStock() })}><header class="store-item__header svelte-1y428ge"><h3 class="svelte-1y428ge">${escape_html(item.name)}</h3> <span class="price svelte-1y428ge">${escape_html(item.price)} monedas</span></header> `);
    if (item.description) {
      $$renderer2.push(`<!--[0--><p class="description svelte-1y428ge">${escape_html(item.description)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <dl class="store-item__meta svelte-1y428ge"><div class="svelte-1y428ge"><dt class="svelte-1y428ge">Stock</dt> <dd class="svelte-1y428ge">${escape_html(item.stock)}/${escape_html(item.max_stock)}</dd></div> <div class="svelte-1y428ge"><dt class="svelte-1y428ge">Duración</dt> <dd class="svelte-1y428ge">${escape_html(item.duration_minutes)} min</dd></div> <div class="svelte-1y428ge"><dt class="svelte-1y428ge">Efecto</dt> <dd class="svelte-1y428ge">${escape_html(EFFECT_TYPE_LABEL[item.effect_type])}
        ${escape_html(formatEffectValue(item.effect_type, item.effect_value))}</dd></div></dl> <button type="button"${attr("disabled", !canBuy(), true)} class="svelte-1y428ge">`);
    if (purchasing) {
      $$renderer2.push(`<!--[0-->Comprando…`);
    } else if (outOfStock()) {
      $$renderer2.push(`<!--[1-->Agotado`);
    } else {
      $$renderer2.push(`<!--[-1-->Comprar`);
    }
    $$renderer2.push(`<!--]--></button> `);
    if (insufficientFunds() && !outOfStock()) {
      $$renderer2.push(`<!--[0--><p class="rejection svelte-1y428ge" role="alert">No tienes suficientes monedas para este item.</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></article>`);
  });
}
function ActiveEffectsList($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { effects } = $$props;
    let now = Date.now();
    onDestroy(() => {
    });
    if (effects.length > 0) {
      $$renderer2.push(`<!--[0--><section class="active-effects svelte-1ox1n8a" aria-label="Efectos activos"><h2 class="svelte-1ox1n8a">Efectos activos</h2> <ul class="svelte-1ox1n8a"><!--[-->`);
      const each_array = ensure_array_like(effects);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let effect = each_array[$$index];
        $$renderer2.push(`<li class="svelte-1ox1n8a"><span class="effect-label">${escape_html(EFFECT_TYPE_LABEL[effect.effect_type])}
            ${escape_html(formatEffectValue(effect.effect_type, effect.effect_value))}</span> <span class="effect-remaining svelte-1ox1n8a">${escape_html(formatRemaining(effect.expires_at, now))}</span></li>`);
      }
      $$renderer2.push(`<!--]--></ul></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    onDestroy(() => {
    });
    $$renderer2.push(`<main class="store-page svelte-1vodbqu"><header class="store-page__header svelte-1vodbqu"><h1 class="svelte-1vodbqu">Tienda</h1> <span class="balance svelte-1vodbqu">Saldo: ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).profile?.coins ?? 0)} monedas</span></header> `);
    ActiveEffectsList($$renderer2, {
      effects: store_get($$store_subs ??= {}, "$storeStore", storeStore).activeEffects
    });
    $$renderer2.push(`<!----> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (store_get($$store_subs ??= {}, "$storeStore", storeStore).purchaseError) {
      $$renderer2.push(`<!--[0--><p class="error svelte-1vodbqu" role="alert">${escape_html(store_get($$store_subs ??= {}, "$storeStore", storeStore).purchaseError)} <button type="button" aria-label="Cerrar" class="svelte-1vodbqu">✕</button></p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (store_get($$store_subs ??= {}, "$storeStore", storeStore).error) {
      $$renderer2.push(`<!--[0--><p class="error svelte-1vodbqu" role="alert">${escape_html(store_get($$store_subs ??= {}, "$storeStore", storeStore).error)}</p>`);
    } else if (store_get($$store_subs ??= {}, "$storeStore", storeStore).loading) {
      $$renderer2.push(`<!--[1--><p class="status svelte-1vodbqu">Cargando tienda…</p>`);
    } else if (store_get($$store_subs ??= {}, "$storeStore", storeStore).items.length === 0) {
      $$renderer2.push(`<!--[2--><p class="status svelte-1vodbqu">No hay items disponibles en este momento.</p>`);
    } else {
      $$renderer2.push(`<!--[-1--><ul class="store-list svelte-1vodbqu"><!--[-->`);
      const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$storeStore", storeStore).items);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        $$renderer2.push(`<li>`);
        StoreItemCard($$renderer2, {
          item,
          userCoins: store_get($$store_subs ??= {}, "$auth", auth).profile?.coins ?? 0,
          purchasing: store_get($$store_subs ??= {}, "$storeStore", storeStore).purchasingId === item.id
        });
        $$renderer2.push(`<!----></li>`);
      }
      $$renderer2.push(`<!--]--></ul>`);
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
