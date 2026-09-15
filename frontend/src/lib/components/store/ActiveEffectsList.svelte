<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ConsumableActivation } from '$lib/types/domain';
  import { EFFECT_TYPE_LABEL, formatEffectValue, formatRemaining } from '$lib/utils/format';

  interface Props {
    effects: ConsumableActivation[];
  }

  let { effects }: Props = $props();

  let now = $state(Date.now());
  let intervalId: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    // Purely visual 1-second tick for the countdown text. Whether an effect
    // is *actually* still active is always decided by Postgres (spec
    // section 16) — the Store page separately re-fetches the active-effects
    // list on a slower interval (see +page.svelte) to drop ones that have
    // truly expired; this timer never talks to the server.
    intervalId = setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

{#if effects.length > 0}
  <section class="active-effects" aria-label="Efectos activos">
    <h2>Efectos activos</h2>
    <ul>
      {#each effects as effect (effect.id)}
        <li>
          <span class="effect-label">
            {EFFECT_TYPE_LABEL[effect.effect_type]}
            {formatEffectValue(effect.effect_type, effect.effect_value)}
          </span>
          <span class="effect-remaining">{formatRemaining(effect.expires_at, now)}</span>
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .active-effects {
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  .active-effects h2 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-muted, #a0a0b0);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.9rem;
  }
  .effect-remaining {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #6fa8ff;
  }
</style>
