<script lang="ts">
  import { onMount } from 'svelte';
  import { online } from '$lib/stores/network';

  // Spec section 37: no invasive UI — a single, calm, non-dismissible
  // status line (not a popup/modal) that appears only while actually
  // offline and disappears the instant connectivity returns, rather than a
  // toast the user has to notice and close.
  onMount(() => online.init());
</script>

{#if !$online}
  <div class="offline-banner" role="status">
    Sin conexión — mostrando los últimos datos guardados en este dispositivo, que pueden estar
    desactualizados.
  </div>
{/if}

<style>
  .offline-banner {
    background: #4a3a12;
    color: #f0d896;
    font-size: 0.85rem;
    text-align: center;
    padding: 0.5rem 1rem;
  }
</style>
