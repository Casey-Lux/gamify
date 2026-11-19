import { writable, get } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import { getCached, setCached } from '$lib/cache/db';
import type { Workspace, WorkspaceMember } from '$lib/types/domain';

export interface WorkspaceState {
  memberships: (WorkspaceMember & { workspace: Workspace })[];
  activeWorkspaceId: string | null;
  loading: boolean;

  activeWorkspaceFromCache: boolean;
}

const initialState: WorkspaceState = {
  memberships: [],
  activeWorkspaceId: null,
  loading: false,
  activeWorkspaceFromCache: false
};

const ACTIVE_WORKSPACE_SETTING_KEY = 'active-workspace-id';

function createWorkspaceStore() {
  const { subscribe, update, set } = writable<WorkspaceState>(initialState);

  async function load() {
    update((s) => ({ ...s, loading: true }));

    const { data, error } = await supabase
      .from('workspace_members')
      .select('id, workspace_id, user_id, role, created_at, updated_at, workspace:workspaces(*)');

    if (error || !data) {
      const cached = await getCached<string>('settings', ACTIVE_WORKSPACE_SETTING_KEY);
      if (cached) {
        set({
          memberships: [],
          activeWorkspaceId: cached.data,
          loading: false,
          activeWorkspaceFromCache: true
        });
      } else {
        update((s) => ({ ...s, loading: false }));
      }
      return;
    }

    const memberships = data as unknown as (WorkspaceMember & { workspace: Workspace })[];

    const personal = memberships.find((m) => m.workspace.is_personal);
    const activeWorkspaceId = personal?.workspace_id ?? memberships[0]?.workspace_id ?? null;

    set({ memberships, activeWorkspaceId, loading: false, activeWorkspaceFromCache: false });
    if (activeWorkspaceId) {
      void setCached('settings', ACTIVE_WORKSPACE_SETTING_KEY, activeWorkspaceId);
    }
  }

  function setActiveWorkspace(workspaceId: string) {
    update((s) => ({ ...s, activeWorkspaceId: workspaceId }));
    void setCached('settings', ACTIVE_WORKSPACE_SETTING_KEY, workspaceId);
  }

  function activeWorkspace(): (WorkspaceMember & { workspace: Workspace }) | undefined {
    const s = get({ subscribe });
    return s.memberships.find((m) => m.workspace_id === s.activeWorkspaceId);
  }

  function reset() {
    set(initialState);
  }

  return { subscribe, load, setActiveWorkspace, activeWorkspace, reset };
}

export const workspaceStore = createWorkspaceStore();
