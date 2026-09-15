<script lang="ts">
  import { page } from '$app/state';
  import { workspaceStore } from '$lib/stores/workspace';
  import UserCard from './UserCard.svelte';

  const links = [
    { href: '/missions', label: 'Misiones' },
    { href: '/store', label: 'Tienda' },
    { href: '/statistics', label: 'Estadísticas' },
    { href: '/profile', label: 'Perfil' }
  ];

  // Spec section 4: only an OWNER administers skills/areas — hidden for a
  // MEMBER rather than shown-then-redirected, to avoid an inviting link
  // straight into a bounce.
  const isOwner = $derived(
    $workspaceStore.memberships.find((m) => m.workspace_id === $workspaceStore.activeWorkspaceId)
      ?.role === 'OWNER'
  );
</script>

<aside class="sidebar" aria-label="Navegación principal">
  <nav>
    <ul>
      {#each links as link (link.href)}
        <li>
          <a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
        </li>
      {/each}
      {#if isOwner}
        <li>
          <a href="/manage" class:active={page.url.pathname === '/manage'}>Gestionar</a>
        </li>
      {/if}
    </ul>
  </nav>
  <UserCard variant="full" />
</aside>

<style>
  .sidebar {
    /* Hidden by default (mobile-first); shown at the desktop breakpoint
     * below. Rendered unconditionally in the DOM either way — spec section
     * 25: "Usar el mismo código funcional para ambos dispositivos." */
    display: none;
  }

  @media (min-width: 860px) {
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      width: 240px;
      flex-shrink: 0;
      padding: 1rem;
      border-right: 1px solid var(--border, #2c2c3a);
      height: 100vh;
      position: sticky;
      top: 0;
    }
  }

  nav ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  nav a {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.75rem;
    border-radius: 0.5rem;
    color: var(--text-muted, #a0a0b0);
    text-decoration: none;
    font-weight: 600;
  }
  nav a.active {
    color: white;
    background: #23233240;
  }
  /* No :hover-only affordance (spec: "sin dependencia de hover") — active
   * state is driven by the current route, not pointer position. */
</style>
