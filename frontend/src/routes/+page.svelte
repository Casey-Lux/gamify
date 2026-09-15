<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // The real auth-aware redirect lives in +layout.svelte's guard; this just
  // picks a sensible default destination once that guard lets us render.
  onMount(() => {
    void goto('/missions');
  });
</script>
