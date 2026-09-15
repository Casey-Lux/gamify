import { s as store_get, e as ensure_array_like, u as unsubscribe_stores, d as derived } from "../../../../chunks/index2.js";
import { a as attr, e as escape_html } from "../../../../chunks/attributes.js";
import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { a as auth } from "../../../../chunks/auth.js";
import { w as workspaceStore } from "../../../../chunks/workspace.js";
import { s as skills, a as areas } from "../../../../chunks/catalog.js";
import "../../../../chunks/client.js";
import { D as DIFFICULTY_LABEL } from "../../../../chunks/format.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    const workspaceId = derived(() => store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).activeWorkspaceId);
    const role = derived(() => store_get($$store_subs ??= {}, "$workspaceStore", workspaceStore).memberships.find((m) => m.workspace_id === workspaceId())?.role ?? null);
    const isOwner = derived(() => role() === "OWNER");
    let title = "";
    let description = "";
    let skillId = "";
    let areaId = "";
    let difficulty = "EASY";
    let xpReward = 10;
    let coinReward = 5;
    let dueAt = "";
    let subtasks = [""];
    let assignedTo = "";
    let members = [];
    let submitting = false;
    $$renderer2.push(`<main class="new-mission-page svelte-1mrculb"><header class="new-mission-page__header svelte-1mrculb"><h1 class="svelte-1mrculb">Nueva misión</h1> <a href="/missions">Volver a misiones</a></header> `);
    if (store_get($$store_subs ??= {}, "$skills", skills).length === 0) {
      $$renderer2.push(`<!--[0--><p class="status svelte-1mrculb">Todavía no hay ninguna skill en este workspace. `);
      if (isOwner()) {
        $$renderer2.push(`<!--[0--><a href="/manage" class="svelte-1mrculb">Crea una primero</a>.`);
      } else {
        $$renderer2.push(`<!--[-1-->Pídele a un OWNER que cree una.`);
      }
      $$renderer2.push(`<!--]--></p>`);
    } else {
      $$renderer2.push(`<!--[-1--><form class="card svelte-1mrculb"><label class="svelte-1mrculb">Título <input type="text"${attr("value", title)} required="" maxlength="120" class="svelte-1mrculb"/></label> <label class="svelte-1mrculb">Descripción <textarea maxlength="2000" rows="3" class="svelte-1mrculb">`);
      const $$body = escape_html(description);
      if ($$body) {
        $$renderer2.push(`${$$body}`);
      }
      $$renderer2.push(`</textarea></label> <div class="grid-2 svelte-1mrculb"><label class="svelte-1mrculb">Skill `);
      $$renderer2.select(
        { value: skillId, required: true, class: "" },
        ($$renderer3) => {
          $$renderer3.push(`<!--[-->`);
          const each_array = ensure_array_like(store_get($$store_subs ??= {}, "$skills", skills));
          for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
            let skill = each_array[$$index];
            $$renderer3.option({ value: skill.id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(skill.name)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        },
        "svelte-1mrculb"
      );
      $$renderer2.push(`</label> <label class="svelte-1mrculb">Área (opcional) `);
      $$renderer2.select(
        { value: areaId, class: "" },
        ($$renderer3) => {
          $$renderer3.option({ value: "" }, ($$renderer4) => {
            $$renderer4.push(`Sin área`);
          });
          $$renderer3.push(`<!--[-->`);
          const each_array_1 = ensure_array_like(store_get($$store_subs ??= {}, "$areas", areas));
          for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
            let area = each_array_1[$$index_1];
            $$renderer3.option({ value: area.id }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(area.name)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        },
        "svelte-1mrculb"
      );
      $$renderer2.push(`</label></div> <div class="grid-2 svelte-1mrculb"><label class="svelte-1mrculb">Dificultad `);
      $$renderer2.select(
        { value: difficulty, class: "" },
        ($$renderer3) => {
          $$renderer3.push(`<!--[-->`);
          const each_array_2 = ensure_array_like(Object.entries(DIFFICULTY_LABEL));
          for (let $$index_2 = 0, $$length = each_array_2.length; $$index_2 < $$length; $$index_2++) {
            let [value, label] = each_array_2[$$index_2];
            $$renderer3.option({ value }, ($$renderer4) => {
              $$renderer4.push(`${escape_html(label)}`);
            });
          }
          $$renderer3.push(`<!--]-->`);
        },
        "svelte-1mrculb"
      );
      $$renderer2.push(`</label> <label class="svelte-1mrculb">Fecha límite (opcional) <input type="datetime-local"${attr("value", dueAt)} class="svelte-1mrculb"/></label></div> <div class="grid-2 svelte-1mrculb"><label class="svelte-1mrculb">Recompensa de XP <input type="number"${attr("value", xpReward)} min="0" step="1" required="" class="svelte-1mrculb"/></label> <label class="svelte-1mrculb">Recompensa de monedas <input type="number"${attr("value", coinReward)} min="0" step="1" required="" class="svelte-1mrculb"/></label></div> `);
      if (isOwner() && members.length > 0) {
        $$renderer2.push(`<!--[0--><label class="svelte-1mrculb">Asignar a `);
        $$renderer2.select(
          { value: assignedTo, class: "" },
          ($$renderer3) => {
            $$renderer3.push(`<!--[-->`);
            const each_array_3 = ensure_array_like(members);
            for (let $$index_3 = 0, $$length = each_array_3.length; $$index_3 < $$length; $$index_3++) {
              let member = each_array_3[$$index_3];
              $$renderer3.option({ value: member.userId }, ($$renderer4) => {
                $$renderer4.push(`${escape_html(member.userId === store_get($$store_subs ??= {}, "$auth", auth).session?.user.id ? `${member.displayName} (yo)` : member.displayName)}`);
              });
            }
            $$renderer3.push(`<!--]-->`);
          },
          "svelte-1mrculb"
        );
        $$renderer2.push(`</label>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <fieldset class="subtasks svelte-1mrculb"><legend class="svelte-1mrculb">Submisiones (opcional)</legend> <!--[-->`);
      const each_array_4 = ensure_array_like(subtasks);
      for (let index = 0, $$length = each_array_4.length; index < $$length; index++) {
        each_array_4[index];
        $$renderer2.push(`<div class="subtask-row svelte-1mrculb"><input type="text"${attr("value", subtasks[index])} placeholder="Título de la submisión" maxlength="120" class="svelte-1mrculb"/> <button type="button" class="remove-btn svelte-1mrculb" aria-label="Quitar submisión">✕</button></div>`);
      }
      $$renderer2.push(`<!--]--> <button type="button" class="add-btn svelte-1mrculb">+ Añadir submisión</button></fieldset> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", submitting, true)} class="svelte-1mrculb">${escape_html("Crear misión")}</button></form>`);
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
