import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import { getCached, setCached } from '$lib/cache/db';
import { catalogCacheKey } from '$lib/cache/keys';
import type { Area, Skill } from '$lib/types/domain';

/**
 * "Catalog" data (skills + areas) needed to populate the Missions filters
 * and the mission creation form. OWNER-managed per spec section 4, but every
 * member can read them (RLS: skills_select / areas_select).
 *
 * Exported as individual stores (rather than one object wrapping them) so
 * each can be used directly with Svelte's `$store` auto-subscription syntax
 * in templates — an object that merely *contains* stores is not itself
 * subscribable.
 */
export const skills = writable<Skill[]>([]);
export const areas = writable<Area[]>([]);
export const catalogLoading = writable(false);
/** True when `skills`/`areas` came from the IndexedDB cache (spec section
 * 27) instead of a successful network read for the active workspace. */
export const catalogFromCache = writable(false);
export const catalogCachedAt = writable<string | null>(null);

interface CachedCatalog {
  skills: Skill[];
  areas: Area[];
}

export async function loadCatalog(workspaceId: string) {
  catalogLoading.set(true);
  const [skillsRes, areasRes] = await Promise.all([
    supabase.from('skills').select('*').eq('workspace_id', workspaceId).order('name'),
    supabase.from('areas').select('*').eq('workspace_id', workspaceId).order('name')
  ]);

  if (!skillsRes.error && skillsRes.data && !areasRes.error && areasRes.data) {
    const skillsData = skillsRes.data as Skill[];
    const areasData = areasRes.data as Area[];
    skills.set(skillsData);
    areas.set(areasData);
    catalogFromCache.set(false);
    catalogCachedAt.set(null);
    catalogLoading.set(false);
    void setCached<CachedCatalog>('catalog', catalogCacheKey(workspaceId), {
      skills: skillsData,
      areas: areasData
    });
    return;
  }

  // Network (or RLS) failure for either query: fall back to whatever this
  // workspace's catalog looked like the last time it loaded successfully
  // (spec section 27 — read-only cache, no partial-merge of one fresh query
  // with one cached query, to avoid mixing two different points in time).
  const cached = await getCached<CachedCatalog>('catalog', catalogCacheKey(workspaceId));
  if (cached) {
    skills.set(cached.data.skills);
    areas.set(cached.data.areas);
    catalogFromCache.set(true);
    catalogCachedAt.set(cached.cachedAt);
  }
  catalogLoading.set(false);
}
