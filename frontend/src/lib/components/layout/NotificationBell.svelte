<script lang="ts">
  import { goto } from '$app/navigation';
  import { notificationsStore } from '$lib/stores/notifications';
  import { NOTIFICATION_TYPE_ICON, type NotificationItem } from '$lib/types/notifications';

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  const badge = $derived(
    $notificationsStore.unreadCount > 99 ? '99+' : String($notificationsStore.unreadCount)
  );

  function toggle() {
    open = !open;
    // Re-evaluates what is due right now from the data already in memory;
    // the sources are refetched when an action changes them, not on every open.
    if (open) notificationsStore.recompute();
  }

  function select(item: NotificationItem) {
    void notificationsStore.markRead(item.key);
    if (item.href) {
      open = false;
      void goto(item.href);
    }
  }

  function onWindowClick(e: MouseEvent) {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') open = false;
  }
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} />

<div class="bell" bind:this={root}>
  <button
    type="button"
    class="bell__button"
    aria-label={$notificationsStore.unreadCount > 0
      ? `Notificaciones, ${$notificationsStore.unreadCount} sin leer`
      : 'Notificaciones'}
    aria-expanded={open}
    onclick={toggle}
  >
    <span aria-hidden="true">🔔</span>
    {#if $notificationsStore.unreadCount > 0}
      <span class="bell__badge" aria-hidden="true">{badge}</span>
    {/if}
  </button>

  {#if open}
    <section class="panel" aria-label="Centro de notificaciones">
      <header class="panel__header">
        <strong>Notificaciones</strong>
        <button
          type="button"
          class="panel__mark-all"
          disabled={$notificationsStore.unreadCount === 0}
          onclick={() => notificationsStore.markAllRead()}
        >
          Marcar todas como leídas
        </button>
      </header>

      {#if $notificationsStore.error}
        <p class="panel__empty" role="alert">{$notificationsStore.error}</p>
      {:else if $notificationsStore.items.length === 0}
        <p class="panel__empty">
          {$notificationsStore.loading ? 'Cargando…' : 'No tienes notificaciones.'}
        </p>
      {:else}
        <ul class="panel__list">
          {#each $notificationsStore.items as item (item.key)}
            <li>
              <button
                type="button"
                class="item"
                class:unread={!item.read}
                onclick={() => select(item)}
              >
                <span class="item__icon" aria-hidden="true"
                  >{NOTIFICATION_TYPE_ICON[item.type]}</span
                >
                <span class="item__text">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </span>
                {#if !item.read}<span class="item__dot" aria-label="No leída"></span>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>

<style>
  .bell {
    position: relative;
    flex-shrink: 0;
  }
  .bell__button {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 1.2rem;
    cursor: pointer;
  }
  .bell__badge {
    position: absolute;
    top: 2px;
    right: 0;
    min-width: 1.1rem;
    padding: 0 0.25rem;
    border-radius: 999px;
    background: #e0574f;
    color: white;
    font-size: 0.65rem;
    font-weight: 700;
    line-height: 1.1rem;
    text-align: center;
  }
  .panel {
    z-index: 40;
    display: flex;
    flex-direction: column;
    background: #1c1c28;
    border: 1px solid var(--border, #2c2c3a);
    border-radius: 0.75rem;
    box-shadow: 0 8px 24px #00000080;
    max-height: min(70vh, 480px);
    /* Mobile: anchored under the sticky header, full width. */
    position: fixed;
    top: 4.5rem;
    left: 0.5rem;
    right: 0.5rem;
  }
  @media (min-width: 860px) {
    /* Desktop: dropdown next to the bell inside the sidebar. */
    .panel {
      position: absolute;
      top: calc(100% + 0.25rem);
      left: 0;
      right: auto;
      width: 360px;
    }
  }
  .panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--border, #2c2c3a);
  }
  .panel__mark-all {
    min-height: 36px;
    background: none;
    border: none;
    color: #6fa8ff;
    font-size: 0.8rem;
    cursor: pointer;
  }
  .panel__mark-all:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .panel__empty {
    margin: 0;
    padding: 1rem;
    color: var(--text-muted, #a0a0b0);
    font-size: 0.9rem;
  }
  .panel__list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }
  .item {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 0.6rem;
    min-height: 44px;
    padding: 0.65rem 0.75rem;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border, #2c2c3a);
    color: var(--text-muted, #a0a0b0);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }
  .item.unread {
    color: #e6e6f0;
    background: #4c6ef51a;
  }
  .item__text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    flex: 1;
    min-width: 0;
    font-size: 0.82rem;
  }
  .item__text strong {
    font-size: 0.88rem;
  }
  .item__dot {
    width: 8px;
    height: 8px;
    margin-top: 0.35rem;
    border-radius: 50%;
    background: #4c6ef5;
    flex-shrink: 0;
  }
</style>
