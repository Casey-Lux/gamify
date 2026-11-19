<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    void goto('/', { replaceState: true });
  });
</script>

<p class="redirecting">Redirigiendo…</p>

<style>
  .redirecting {
    padding: 2rem;
    text-align: center;
    color: #a0a0b0;
  }
</style>
