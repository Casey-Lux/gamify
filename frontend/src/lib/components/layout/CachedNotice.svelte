<script lang="ts">
  import { formatCacheAge } from '$lib/utils/format';

  interface Props {
    cachedAt: string;
  }
  let { cachedAt }: Props = $props();
</script>

<p class="cached-notice" role="note">
  Datos guardados {formatCacheAge(cachedAt)} — puede que no reflejen los cambios más recientes.
</p>

<style>
  .cached-notice {
    margin: 0;
    font-size: 0.8rem;
    color: #a0a0b0;
    font-style: italic;
  }
</style>
