<script lang="ts">
  import { formatCacheAge } from '$lib/utils/format';

  interface Props {
    cachedAt: string;
  }
  let { cachedAt }: Props = $props();
</script>

<!--
  Small, reused-everywhere note (Missions/Statistics/Profile) for whenever a
  store's `fromCache` flag is true (spec section 27: "dejando claro cuándo
  los datos pueden estar desactualizados"). Inline text, not a banner/toast —
  this is expected, calm state (you're offline or the server hiccuped), not
  an alert to react to.
-->
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
