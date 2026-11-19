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
