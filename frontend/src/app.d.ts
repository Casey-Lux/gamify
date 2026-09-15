// See https://svelte.dev/docs/kit/types#app.d.ts
// This app is a static SPA (adapter-static, no SSR — spec section 50), so
// App.Locals / App.PageData are intentionally left minimal: there is no
// server-side request lifecycle to attach anything to.
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
