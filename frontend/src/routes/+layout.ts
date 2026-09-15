// This app is a private, authenticated SPA with no SEO needs (spec section
// 50). Disabling SSR and prerender keeps every route rendered purely
// client-side against Supabase, matching adapter-static's `fallback:
// 'index.html'` in svelte.config.js.
export const ssr = false;
export const prerender = false;
