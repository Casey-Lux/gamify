<script lang="ts">
  import { onMount } from 'svelte';
  import { online } from '$lib/stores/network';

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
