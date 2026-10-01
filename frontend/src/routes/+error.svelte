<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // Unknown routes go to `/`; `/` then sends the user to /missions or /login
  // depending on whether they are authenticated (see +layout.svelte).
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
