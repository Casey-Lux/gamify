<script lang="ts">
  import { page } from '$app/state';
  import { workspaceStore } from '$lib/stores/workspace';

  const isOwner = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === $workspaceStore.activeWorkspaceId)
      ?.role === 'OWNER'
  );

  const links = $derived([
    { href: '/missions', label: 'Misiones', icon: '🗒️' },
    { href: '/daily-plan', label: 'Plan', icon: '📅' },
    { href: '/habits', label: 'Hábitos', icon: '🔁' },
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
