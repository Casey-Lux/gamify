<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { auth } from '$lib/stores/auth';
  import { workspaceStore } from '$lib/stores/workspace';
  import { loadCatalog } from '$lib/stores/catalog';
  import { userSkillsStore } from '$lib/stores/user-skills';
  import { installPrompt } from '$lib/pwa/install-prompt';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';
  import UserCard from '$lib/components/layout/UserCard.svelte';
  import OfflineBanner from '$lib/components/layout/OfflineBanner.svelte';

  let { children } = $props();

  const PUBLIC_ROUTES = new Set(['/login']);

  onMount(() => {
    void auth.init();
    return installPrompt.init();
  });

  // Auth guard: redirect to /login when there's no session, and away from
  // /login once there is one. This app has no SSR (adapter-static), so the
  // guard runs entirely client-side, once auth state is known.
  $effect(() => {
    if ($auth.loading) return;
    const isPublic = PUBLIC_ROUTES.has(page.url.pathname);

    if (!$auth.session && !isPublic) {
      void goto('/login');
    } else if ($auth.session && isPublic) {
      void goto('/missions');
    }
  });

  // Once authenticated, load the active workspace, its skill/area catalog,
  // and the User Card's own skill-progress list.
  $effect(() => {
    if (!$auth.session) return;
    void workspaceStore.load();
    void userSkillsStore.load();
  });

  $effect(() => {
    const workspaceId = $workspaceStore.activeWorkspaceId;
    if (workspaceId) void loadCatalog(workspaceId);
  });

  const showChrome = $derived(!!$auth.session && !PUBLIC_ROUTES.has(page.url.pathname));
</script>

{#if $auth.loading}
  <div class="app-loading">Cargando…</div>
{:else if showChrome}
  <div class="app-shell">
    <Sidebar />
    <div class="app-shell__content">
      <OfflineBanner />
      <UserCard variant="compact" />
      <div class="app-shell__page">
        {@render children()}
      </div>
    </div>
    <BottomNav />
  </div>
{:else}
  <OfflineBanner />
  {@render children()}
{/if}

<style>
  :global(body) {
    margin: 0;
    background: #0f0f17;
    color: #e6e6f0;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      sans-serif;
  }
  .app-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }

  /*
   * Spec section 25 "Responsive design": one shell, one markup tree, for
   * both desktop and Android — Sidebar and BottomNav each decide their own
   * visibility via their own media queries (mobile-first: hidden unless the
   * breakpoint says otherwise), so nothing here needs a JS viewport check
   * or two separate render branches.
   */
  .app-shell {
    display: flex;
    min-height: 100vh;
  }
  .app-shell__content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .app-shell__page {
    flex: 1;
    /* Room for the fixed BottomNav on mobile; desktop has no bottom nav so
     * no extra padding is needed there. */
    padding-bottom: 4.5rem;
  }
  @media (min-width: 860px) {
    .app-shell__page {
      padding-bottom: 0;
    }
  }
</style>
