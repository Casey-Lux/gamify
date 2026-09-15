import { e as ensure_array_like, a as attr_class, d as derived, s as store_get, u as unsubscribe_stores } from "../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
import { p as page } from "../../chunks/index.js";
import { a as auth } from "../../chunks/auth.js";
import { w as workspaceStore } from "../../chunks/workspace.js";
import "../../chunks/client.js";
import "idb";
import "../../chunks/user-skills.js";
import { U as UserCard } from "../../chunks/UserCard.js";
import { a as attr, e as escape_html } from "../../chunks/attributes.js";
import { w as writable } from "../../chunks/index3.js";
function Sidebar($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const links = [
      { href: "/missions", label: "Misiones" },
      { href: "/store", label: "Tienda" },
      { href: "/statistics", label: "Estadísticas" },
      { href: "/profile", label: "Perfil" }
    ];
    const isOwner = derived(() => store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).memberships.find((m) => m.workspace_id === store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).activeWorkspaceId)?.role === "OWNER");
    $$renderer2.push(`<aside class="sidebar svelte-6dohdz" aria-label="Navegación principal"><nav class="svelte-6dohdz"><ul class="svelte-6dohdz"><!--[-->`);
    const each_array = ensure_array_like(links);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let link = each_array[$$index];
      $$renderer2.push(`<li><a${attr("href", link.href)}${attr_class("svelte-6dohdz", void 0, { "active": page.url.pathname === link.href })}>${escape_html(link.label)}</a></li>`);
    }
    $$renderer2.push(`<!--]--> `);
    if (isOwner()) {
      $$renderer2.push(`<!--[0--><li><a href="/manage"${attr_class("svelte-6dohdz", void 0, { "active": page.url.pathname === "/manage" })}>Gestionar</a></li>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></ul></nav> `);
    UserCard($$renderer2, { variant: "full" });
    $$renderer2.push(`<!----></aside>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function BottomNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const isOwner = derived(() => store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).memberships.find((m) => m.workspace_id === store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).activeWorkspaceId)?.role === "OWNER");
    const links = derived(() => [
      { href: "/missions", label: "Misiones", icon: "🗒️" },
      { href: "/store", label: "Tienda", icon: "🛒" },
      { href: "/statistics", label: "Stats", icon: "📊" },
      ...isOwner() ? [{ href: "/manage", label: "Gestionar", icon: "🛠️" }] : [],
      { href: "/profile", label: "Perfil", icon: "👤" }
    ]);
    $$renderer2.push(`<nav class="bottom-nav svelte-qzbt73" aria-label="Navegación principal"><!--[-->`);
    const each_array = ensure_array_like(links());
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let link = each_array[$$index];
      $$renderer2.push(`<a${attr("href", link.href)}${attr_class("svelte-qzbt73", void 0, { "active": page.url.pathname === link.href })}><span class="icon svelte-qzbt73" aria-hidden="true">${escape_html(link.icon)}</span> <span class="label">${escape_html(link.label)}</span></a>`);
    }
    $$renderer2.push(`<!--]--></nav>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function createNetworkStore() {
  const { subscribe, set } = writable(true);
  function init() {
    return () => {
    };
  }
  return { subscribe, init };
}
const online = createNetworkStore();
function OfflineBanner($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    if (!store_get($$store_subs ??= {}, "$online", online)) {
      $$renderer2.push(`<!--[0--><div class="offline-banner svelte-jqfx1s" role="status">Sin conexión — mostrando los últimos datos guardados en este dispositivo, que pueden estar
    desactualizados.</div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { children } = $$props;
    const PUBLIC_ROUTES = /* @__PURE__ */ new Set(["/login"]);
    const showChrome = derived(() => !!store_get($$store_subs ??= {}, "$auth", auth).session && !PUBLIC_ROUTES.has(page.url.pathname));
    if (store_get($$store_subs ??= {}, "$auth", auth).loading) {
      $$renderer2.push(`<!--[0--><div class="app-loading svelte-12qhfyh">Cargando…</div>`);
    } else if (showChrome()) {
      $$renderer2.push(`<!--[1--><div class="app-shell svelte-12qhfyh">`);
      Sidebar($$renderer2);
      $$renderer2.push(`<!----> <div class="app-shell__content svelte-12qhfyh">`);
      OfflineBanner($$renderer2);
      $$renderer2.push(`<!----> `);
      UserCard($$renderer2, { variant: "compact" });
      $$renderer2.push(`<!----> <div class="app-shell__page svelte-12qhfyh">`);
      children($$renderer2);
      $$renderer2.push(`<!----></div></div> `);
      BottomNav($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
      OfflineBanner($$renderer2);
      $$renderer2.push(`<!----> `);
      children($$renderer2);
      $$renderer2.push(`<!---->`);
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _layout as default
};
