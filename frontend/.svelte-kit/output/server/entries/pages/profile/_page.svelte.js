import { s as store_get, u as unsubscribe_stores } from "../../../chunks/index2.js";
import { a as auth } from "../../../chunks/auth.js";
import "../../../chunks/client.js";
import { U as UserCard, i as installPrompt } from "../../../chunks/UserCard.js";
import { a as attr, e as escape_html } from "../../../chunks/attributes.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let displayName = store_get($$store_subs ??= {}, "$auth", auth).profile?.display_name ?? "";
    let savingName = false;
    let uploading = false;
    $$renderer2.push(`<main class="profile-page svelte-maq4gq"><h1 class="svelte-maq4gq">Perfil</h1> `);
    UserCard($$renderer2, { variant: "full" });
    $$renderer2.push(`<!----> `);
    if (store_get($$store_subs ??= {}, "$installPrompt", installPrompt)) {
      $$renderer2.push(`<!--[0--><section class="card svelte-maq4gq"><h2 class="svelte-maq4gq">Instalar aplicación</h2> <p class="hint svelte-maq4gq">Instala Gamify en este dispositivo para abrirla como una app, sin la barra del navegador, y
        con acceso a tus últimos datos aunque te quedes sin conexión.</p> <button type="button" class="install-cta svelte-maq4gq">Instalar</button></section>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <section class="card svelte-maq4gq"><h2 class="svelte-maq4gq">Avatar</h2> <p class="hint svelte-maq4gq">JPG, PNG o WebP. Se recorta a cuadrado y se comprime automáticamente.</p> <input type="file" accept="image/png,image/jpeg,image/webp"${attr("disabled", uploading, true)} class="svelte-maq4gq"/> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></section> <form class="card svelte-maq4gq"><h2 class="svelte-maq4gq">Nombre</h2> <label class="svelte-maq4gq">Nombre visible <input type="text"${attr("value", displayName)} required="" maxlength="60" class="svelte-maq4gq"/></label> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", savingName, true)} class="svelte-maq4gq">${escape_html("Guardar")}</button></form></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
export {
  _page as default
};
