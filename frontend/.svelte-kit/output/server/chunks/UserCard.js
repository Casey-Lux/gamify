import { w as writable } from "./index3.js";
import { a as attr_class, s as store_get, e as ensure_array_like, u as unsubscribe_stores, d as derived } from "./index2.js";
import { a as auth } from "./auth.js";
import { u as userSkillsStore } from "./user-skills.js";
import "./client.js";
import { C as CachedNotice } from "./CachedNotice.js";
import { a as attr, e as escape_html } from "./attributes.js";
function createInstallPromptStore() {
  const { subscribe, set } = writable(false);
  function init() {
    return () => {
    };
  }
  async function promptInstall() {
    return;
  }
  return { subscribe, init, promptInstall };
}
const installPrompt = createInstallPromptStore();
function UserCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { variant } = $$props;
    let expanded = false;
    const showDetails = derived(() => variant === "full" || expanded);
    const initial = derived(() => (store_get($$store_subs ??= {}, "$auth", auth).profile?.display_name ?? "?").charAt(0).toUpperCase());
    const cacheNotice = derived(() => {
      const candidates = [];
      if (store_get($$store_subs ??= {}, "$auth", auth).profileFromCache && store_get($$store_subs ??= {}, "$auth", auth).profileCachedAt) candidates.push(store_get($$store_subs ??= {}, "$auth", auth).profileCachedAt);
      if (store_get($$store_subs ??= {}, "$userSkillsStore", userSkillsStore).fromCache && store_get($$store_subs ??= {}, "$userSkillsStore", userSkillsStore).cachedAt) candidates.push(store_get($$store_subs ??= {}, "$userSkillsStore", userSkillsStore).cachedAt);
      if (candidates.length === 0) return null;
      return candidates.sort().at(-1) ?? null;
    });
    $$renderer2.push(`<section${attr_class("user-card svelte-kilo16", void 0, { "compact": variant === "compact" })}><button type="button" class="user-card__summary svelte-kilo16"${attr("aria-expanded", variant === "compact" ? expanded : void 0)}><span class="avatar svelte-kilo16" aria-hidden="true">`);
    {
      $$renderer2.push(`<!--[-1--><span class="avatar-placeholder svelte-kilo16">${escape_html(initial())}</span>`);
    }
    $$renderer2.push(`<!--]--></span> <span class="summary-text svelte-kilo16"><strong class="svelte-kilo16">${escape_html(store_get($$store_subs ??= {}, "$auth", auth).profile?.display_name ?? "Jugador")}</strong> <span class="summary-meta svelte-kilo16">Nivel ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).profile?.level ?? 1)} · ${escape_html(store_get($$store_subs ??= {}, "$auth", auth).profile?.coins ?? 0)} monedas</span></span> `);
    if (variant === "compact") {
      $$renderer2.push(`<!--[0--><span class="chevron svelte-kilo16" aria-hidden="true">${escape_html("▼")}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></button> `);
    if (showDetails()) {
      $$renderer2.push(`<!--[0--><div class="user-card__details svelte-kilo16">`);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (store_get($$store_subs ??= {}, "$userSkillsStore", userSkillsStore).skills.length > 0) {
        $$renderer2.push(`<!--[0--><ul class="skills-list svelte-kilo16"><!--[-->`);
        const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$userSkillsStore", userSkillsStore).skills);
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let skill = each_array[$$index];
          $$renderer2.push(`<li class="svelte-kilo16"><span>${escape_html(skill.skill_name)}</span><span>Nv. ${escape_html(skill.level)}</span></li>`);
        }
        $$renderer2.push(`<!--]--></ul>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (cacheNotice()) {
        $$renderer2.push("<!--[0-->");
        CachedNotice($$renderer2, { cachedAt: cacheNotice() });
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <a class="edit-link svelte-kilo16" href="/profile">Editar perfil</a></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  UserCard as U,
  installPrompt as i
};
