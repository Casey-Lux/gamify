import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Prompt maestro section 1 / 50: adapter-static, no SSR (the app is
 * private/authenticated and does not need SEO), deployed as a static site to
 * Cloudflare Pages, with Supabase as the only backend.
 *
 * fallback: 'index.html' turns this into a proper SPA — every unmatched path
 * falls back to the app shell, and SvelteKit's client-side router (plus our
 * own auth guard in src/routes/+layout.ts) takes it from there. This is
 * required because Cloudflare Pages does not know about SvelteKit's routes.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      precompress: false,
      strict: true
    })
  }
};

export default config;
