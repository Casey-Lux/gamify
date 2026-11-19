<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { auth } from '$lib/stores/auth';
  import { workspaceStore } from '$lib/stores/workspace';
  import { loadCatalog } from '$lib/stores/catalog';
  import { userSkillsStore } from '$lib/stores/user-skills';
  import { notificationsStore } from '$lib/stores/notifications';
  import { missionsStore } from '$lib/stores/missions';
  import { habitsStore } from '$lib/stores/habits';
  import { statisticsStore } from '$lib/stores/statistics';
  import { storeStore } from '$lib/stores/store';
  import { installPrompt } from '$lib/pwa/install-prompt';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';
  import UserCard from '$lib/components/layout/UserCard.svelte';
  import OfflineBanner from '$lib/components/layout/OfflineBanner.svelte';

  let { children } = $props();

  const PUBLIC_ROUTES = new Set(['/login', '/check-email']);

  onMount(() => {
    void auth.init();
    return installPrompt.init();
  });

  $effect(() => {
    if ($auth.loading) return;

    if (page.status === 404) return;
    const pathname = page.url.pathname;
    const isPublic = PUBLIC_ROUTES.has(pathname);

    if (!$auth.session && !isPublic) {
      void goto('/login');
    } else if ($auth.session && pathname === '/login') {
      void goto('/missions');
    }
  });

  const userId = $derived($auth.session?.user.id ?? null);

  let lastUserId: string | null = null;

  $effect(() => {
    if (lastUserId !== null && lastUserId !== userId) {
      missionsStore.reset();
      habitsStore.reset();
      statisticsStore.reset();
      storeStore.reset();
      userSkillsStore.reset();
      workspaceStore.reset();
    }
    lastUserId = userId;
    if (!userId) return;
    void workspaceStore.load();
    void userSkillsStore.load();
  });

  $effect(() => {
    if (!userId) {
      notificationsStore.reset();
      return;
    }
    return notificationsStore.start();
  });

  const activeWorkspaceId = $derived($workspaceStore.activeWorkspaceId);
  $effect(() => {
    if (activeWorkspaceId) void loadCatalog(activeWorkspaceId);
  });

  const showChrome = $derived(
    !!$auth.session && page.status !== 404 && !PUBLIC_ROUTES.has(page.url.pathname)
  );
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

    padding-bottom: 4.5rem;
  }
  @media (min-width: 860px) {
    .app-shell__page {
      padding-bottom: 0;
    }
  }
</style>
