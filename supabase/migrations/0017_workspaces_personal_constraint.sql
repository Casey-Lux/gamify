create unique index workspaces_one_personal_per_creator_idx
  on public.workspaces (created_by)
  where is_personal;
