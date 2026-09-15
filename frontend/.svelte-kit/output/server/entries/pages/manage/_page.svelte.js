import { s as store_get, e as ensure_array_like, u as unsubscribe_stores, d as derived } from "../../../chunks/index2.js";
import { e as escape_html, a as attr } from "../../../chunks/attributes.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { w as workspaceStore } from "../../../chunks/workspace.js";
import { s as skills, a as areas } from "../../../chunks/catalog.js";
import "../../../chunks/client.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const workspaceId = derived(() => store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).activeWorkspaceId);
    const role = derived(() => store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).memberships.find((m) => m.workspace_id === workspaceId())?.role ?? null);
    const isOwner = derived(() => role() === "OWNER");
    let skillName = "";
    let skillDescription = "";
    let skillSubmitting = false;
    let areaName = "";
    let areaSubmitting = false;
    $$renderer2.push(`<main class="manage-page svelte-1s1mgsk"><h1 class="svelte-1s1mgsk">Gestionar workspace</h1> `);
    if (isOwner()) {
      $$renderer2.push(`<!--[0--><section class="card svelte-1s1mgsk"><h2 class="svelte-1s1mgsk">Skills</h2> <p class="hint svelte-1s1mgsk">Cada misión pertenece a exactamente una skill. Los miembros ganan XP y nivel propios en cada
        skill al completar misiones.</p> `);
      if (store_get($$store_subs ??= {}, "$skills", skills).length > 0) {
        $$renderer2.push(`<!--[0--><ul class="item-list svelte-1s1mgsk"><!--[-->`);
        const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$skills", skills));
        for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
          let skill = each_array[$$index];
          $$renderer2.push(`<li><strong>${escape_html(skill.name)}</strong> `);
          if (skill.description) {
            $$renderer2.push(`<!--[0--><span class="muted svelte-1s1mgsk">— ${escape_html(skill.description)}</span>`);
          } else {
            $$renderer2.push("<!--[-1-->");
          }
          $$renderer2.push(`<!--]--></li>`);
        }
        $$renderer2.push(`<!--]--></ul>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <form class="svelte-1s1mgsk"><label class="svelte-1s1mgsk">Nombre <input type="text"${attr("value", skillName)} required="" maxlength="60" class="svelte-1s1mgsk"/></label> <label class="svelte-1s1mgsk">Descripción (opcional) <input type="text"${attr("value", skillDescription)} maxlength="500" class="svelte-1s1mgsk"/></label> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", skillSubmitting, true)} class="svelte-1s1mgsk">${escape_html("Crear skill")}</button></form></section> <section class="card svelte-1s1mgsk"><h2 class="svelte-1s1mgsk">Áreas</h2> <p class="hint svelte-1s1mgsk">Una misión puede pertenecer opcionalmente a un área.</p> `);
      if (store_get($$store_subs ??= {}, "$areas", areas).length > 0) {
        $$renderer2.push(`<!--[0--><ul class="item-list svelte-1s1mgsk"><!--[-->`);
        const each_array_1 = ensure_array_like(store_get($$store_subs ??= {}, "$areas", areas));
        for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
          let area = each_array_1[$$index_1];
          $$renderer2.push(`<li><strong>${escape_html(area.name)}</strong></li>`);
        }
        $$renderer2.push(`<!--]--></ul>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <form class="svelte-1s1mgsk"><label class="svelte-1s1mgsk">Nombre <input type="text"${attr("value", areaName)} required="" maxlength="60" class="svelte-1s1mgsk"/></label> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", areaSubmitting, true)} class="svelte-1s1mgsk">${escape_html("Crear área")}</button></form></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
