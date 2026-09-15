<script lang="ts">
  import { auth } from '$lib/stores/auth';
  import { userSkillsStore } from '$lib/stores/user-skills';
  import { fetchLevelProgress } from '$lib/api/level';
  import { getAvatarSignedUrl } from '$lib/api/avatar';
  import CachedNotice from './CachedNotice.svelte';
  import type { LevelProgress } from '$lib/types/domain';

  interface Props {
    variant: 'full' | 'compact';
  }

  let { variant }: Props = $props();

  let expanded = $state(false);
  let levelProgress = $state<LevelProgress | null>(null);
  let avatarUrl = $state<string | null>(null);

  // Spec section 24: the card must reflect completar misión / comprar item /
  // subir nivel / actualizar skill immediately. It never recomputes the
  // level formula itself (Fase 1 rule) — every time total_xp changes (any
  // of those four events refreshes `auth.profile`), it re-asks the
  // `calculate_level_progress` RPC for the current progress bar values.
  $effect(() => {
    const xp = $auth.profile?.total_xp;
    if (xp === undefined) return;
    // Fase 11: offline, this RPC call fails (it always needs the live
    // server — spec section 7, the formula is never duplicated
    // client-side). Swallow the rejection and simply keep whatever
    // progress bar was last computed rather than raising an unhandled
    // rejection; `$auth.profile` itself (level/coins/total_xp) still comes
    // through from the IndexedDB cache regardless.
    void fetchLevelProgress(xp)
      .then((p) => (levelProgress = p))
      .catch(() => {});
  });

  $effect(() => {
    const path = $auth.profile?.avatar_path;
    if (!path) {
      avatarUrl = null;
      return;
    }
    void getAvatarSignedUrl(path).then((url) => (avatarUrl = url));
  });

  const showDetails = $derived(variant === 'full' || expanded);
  const initial = $derived(($auth.profile?.display_name ?? '?').charAt(0).toUpperCase());

  // Fase 11 (spec section 27): surface whichever of the two data sources
  // this card renders — profile or per-skill progress — is currently
  // showing a cached-while-offline copy, picking the more recent of the
  // two cachedAt timestamps if both happen to be stale at once.
  const cacheNotice = $derived.by(() => {
    const candidates: string[] = [];
    if ($auth.profileFromCache && $auth.profileCachedAt) candidates.push($auth.profileCachedAt);
    if ($userSkillsStore.fromCache && $userSkillsStore.cachedAt)
      candidates.push($userSkillsStore.cachedAt);
    if (candidates.length === 0) return null;
    return candidates.sort().at(-1) ?? null;
  });

  function toggle() {
    if (variant === 'compact') expanded = !expanded;
  }
</script>

<section class="user-card" class:compact={variant === 'compact'}>
  <button
    type="button"
    class="user-card__summary"
    onclick={toggle}
    aria-expanded={variant === 'compact' ? expanded : undefined}
  >
    <span class="avatar" aria-hidden="true">
      {#if avatarUrl}
        <img src={avatarUrl} alt="" />
      {:else}
        <span class="avatar-placeholder">{initial}</span>
      {/if}
    </span>
    <span class="summary-text">
      <strong>{$auth.profile?.display_name ?? 'Jugador'}</strong>
      <span class="summary-meta"
        >Nivel {$auth.profile?.level ?? 1} · {$auth.profile?.coins ?? 0} monedas</span
      >
    </span>
    {#if variant === 'compact'}
      <span class="chevron" aria-hidden="true">{expanded ? '▲' : '▼'}</span>
    {/if}
  </button>

  {#if showDetails}
    <div class="user-card__details">
      {#if levelProgress}
        <div
          class="xp-progress"
          role="progressbar"
          aria-valuenow={levelProgress.progress_percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div class="xp-progress__bar" style={`width: ${levelProgress.progress_percent}%`}></div>
        </div>
        <p class="xp-text">
          {levelProgress.xp_into_level}/{levelProgress.xp_for_next_level} XP para nivel {levelProgress.level +
            1}
        </p>
      {/if}

      {#if $userSkillsStore.skills.length > 0}
        <ul class="skills-list">
          {#each $userSkillsStore.skills as skill (skill.skill_id)}
            <li><span>{skill.skill_name}</span><span>Nv. {skill.level}</span></li>
          {/each}
        </ul>
      {/if}

      {#if cacheNotice}
        <CachedNotice cachedAt={cacheNotice} />
      {/if}

      <a class="edit-link" href="/profile">Editar perfil</a>
    </div>
  {/if}
</section>

<style>
  .user-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--surface, #1c1c28);
    border: 1px solid var(--border, #2c2c3a);
  }
  /* The compact variant is only ever used in the mobile header; at the
   * desktop breakpoint the Sidebar already renders its own "full" instance,
   * so this one is hidden rather than duplicated — spec section 25: full
   * card on desktop, compact card on mobile, never both. */
  @media (min-width: 860px) {
    .user-card.compact {
      display: none;
    }
  }
  @media (max-width: 859px) {
    .user-card.compact {
      border-radius: 0;
      border-left: none;
      border-right: none;
      border-top: none;
      position: sticky;
      top: 0;
      z-index: 10;
    }
  }
  .user-card__summary {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: none;
    border: none;
    color: inherit;
    padding: 0;
    text-align: left;
    width: 100%;
    min-height: 44px;
    cursor: default;
  }
  .compact .user-card__summary {
    cursor: pointer;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background: #2c2c3a;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .avatar-placeholder {
    font-weight: 700;
    color: var(--text-muted, #a0a0b0);
  }
  .summary-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
    flex: 1;
  }
  .summary-text strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .summary-meta {
    font-size: 0.8rem;
    color: var(--text-muted, #a0a0b0);
  }
  .chevron {
    color: var(--text-muted, #a0a0b0);
  }
  .user-card__details {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .xp-progress {
    height: 8px;
    border-radius: 999px;
    background: #2c2c3a;
    overflow: hidden;
  }
  .xp-progress__bar {
    height: 100%;
    background: #4c6ef5;
  }
  .xp-text {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted, #a0a0b0);
  }
  .skills-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.85rem;
  }
  .skills-list li {
    display: flex;
    justify-content: space-between;
  }
  .edit-link {
    font-size: 0.8rem;
    color: #6fa8ff;
    text-decoration: none;
    align-self: flex-start;
    min-height: 32px;
    display: flex;
    align-items: center;
  }
</style>
