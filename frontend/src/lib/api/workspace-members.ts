import { supabase } from '$lib/supabase/client';

export class WorkspaceMembersApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkspaceMembersApiError';
  }
}

export interface WorkspaceMemberOption {
  userId: string;
  displayName: string;
}

/**
 * Only used to populate the "asignar a" picker on the mission-creation form
 * for an OWNER (spec section 4: a MEMBER may only assign missions to
 * themselves, so this is never called for a MEMBER). Readable by any member
 * of the workspace per `workspace_members_select` / `profiles_select`
 * (0016_rls_policies.sql) — the OWNER-only restriction here is a UI choice,
 * not an RLS one.
 */
export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberOption[]> {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, profile:profiles(display_name)')
    .eq('workspace_id', workspaceId);

  if (error) throw new WorkspaceMembersApiError(error.message);

  return (
    (data ?? []) as unknown as { user_id: string; profile: { display_name: string } | null }[]
  )
    .map((row) => ({ userId: row.user_id, displayName: row.profile?.display_name ?? row.user_id }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
