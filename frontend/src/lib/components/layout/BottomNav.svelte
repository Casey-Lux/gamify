<script lang="ts">
  import { page } from '$app/state';
  import { workspaceStore } from '$lib/stores/workspace';

  const isOwner = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === $workspaceStore.activeWorkspaceId)
      ?.role === 'OWNER'
  );

  const links = $derived([
    { href: '/missions', label: 'Misiones', icon: '🗒️' },
    { href: '/store', label: 'Tienda', icon: '🛒' },
    { href: '/statistics', label: 'Stats', icon: '📊' },
    ...(isOwner ? [{ href: '/manage', label: 'Gestionar', icon: '🛠️' }] : []),
    { href: '/profile', label: 'Perfil', icon: '👤' }
  ]);
</script>

<nav class="bottom-nav" aria-label="Navegación principal">
  {#each links as link (link.href)}
    <a href={link.href} class:active={page.url.pathname === link.href}>
      <span class="icon" aria-hidden="true">{link.icon}</span>
      <span class="label">{link.label}</span>
    </a>
  {/each}
</nav>

<style>
  .bottom-nav {
    /* Hidden by default; shown only below the desktop breakpoint, where the
     * Sidebar (which has its own opposite media query) is hidden instead —
     * spec section 25: "Android: navegación inferior." */
    display: none;
  }

  @media (max-width: 859px) {
    .bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 20;
      background: #14141f;
      border-top: 1px solid var(--border, #2c2c3a);
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
  }

  .bottom-nav a {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    /* Touch target well above the usual 44px minimum, since this is the
     * primary navigation surface on mobile — spec: "touch targets
     * adecuados". */
    min-height: 56px;
    color: var(--text-muted, #a0a0b0);
    text-decoration: none;
    font-size: 0.7rem;
  }
  .bottom-nav a.active {
    color: white;
  }
  .icon {
    font-size: 1.2rem;
  }
</style>
