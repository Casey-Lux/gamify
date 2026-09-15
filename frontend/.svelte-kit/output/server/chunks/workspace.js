import { w as writable, g as get } from "./index3.js";
import { s as supabase } from "./client.js";
import { s as setCached, g as getCached } from "./db.js";
const initialState = {
  memberships: [],
  activeWorkspaceId: null,
  loading: false,
  activeWorkspaceFromCache: false
};
const ACTIVE_WORKSPACE_SETTING_KEY = "active-workspace-id";
function createWorkspaceStore() {
  const { subscribe, update, set } = writable(initialState);
  async function load() {
    update((s) => ({ ...s, loading: true }));
    const { data, error } = await supabase.from("workspace_members").select("id, workspace_id, user_id, role, created_at, updated_at, workspace:workspaces(*)");
    if (error || !data) {
      const cached = await getCached("settings", ACTIVE_WORKSPACE_SETTING_KEY);
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
    const memberships = data;
    const personal = memberships.find((m) => m.workspace.is_personal);
    const activeWorkspaceId = personal?.workspace_id ?? memberships[0]?.workspace_id ?? null;
    set({ memberships, activeWorkspaceId, loading: false, activeWorkspaceFromCache: false });
    if (activeWorkspaceId) {
      void setCached("settings", ACTIVE_WORKSPACE_SETTING_KEY, activeWorkspaceId);
    }
  }
  function setActiveWorkspace(workspaceId) {
    update((s) => ({ ...s, activeWorkspaceId: workspaceId }));
    void setCached("settings", ACTIVE_WORKSPACE_SETTING_KEY, workspaceId);
  }
  function activeWorkspace() {
    const s = get({ subscribe });
    return s.memberships.find((m) => m.workspace_id === s.activeWorkspaceId);
  }
  function reset() {
    set(initialState);
  }
  return { subscribe, load, setActiveWorkspace, activeWorkspace, reset };
}
const workspaceStore = createWorkspaceStore();
export {
  workspaceStore as w
};
