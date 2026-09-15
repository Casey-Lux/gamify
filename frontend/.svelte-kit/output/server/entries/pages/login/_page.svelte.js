import { e as escape_html, a as attr } from "../../../chunks/attributes.js";
import "../../../chunks/client.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let email = "";
    let password = "";
    let loading = false;
    $$renderer2.push(`<main class="login svelte-1x05zx6"><form class="svelte-1x05zx6"><h1 class="svelte-1x05zx6">Gamify</h1> <p class="subtitle svelte-1x05zx6">${escape_html("Inicia sesión")}</p> <label class="svelte-1x05zx6">Email <input type="email"${attr("value", email)} required="" autocomplete="email" class="svelte-1x05zx6"/></label> <label class="svelte-1x05zx6">Contraseña <input type="password"${attr("value", password)} required="" autocomplete="current-password" minlength="8" class="svelte-1x05zx6"/></label> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button type="submit"${attr("disabled", loading, true)} class="svelte-1x05zx6">${escape_html("Entrar")}</button> <button type="button" class="link svelte-1x05zx6">${escape_html(
      "¿No tienes cuenta? Regístrate"
    )}</button></form></main>`);
  });
}
export {
  _page as default
};
