import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import { getCached, setCached } from '$lib/cache/db';
import { catalogCacheKey } from '$lib/cache/keys';
import type { Area, Skill } from '$lib/types/domain';

export const skills = writable<Skill[]>([]);
export const areas = writable<Area[]>([]);
export const catalogLoading = writable(false);

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

  const cached = await getCached<CachedCatalog>('catalog', catalogCacheKey(workspaceId));
  if (cached) {
    skills.set(cached.data.skills);
    areas.set(cached.data.areas);
    catalogFromCache.set(true);
    catalogCachedAt.set(cached.cachedAt);
  }
  catalogLoading.set(false);
}
