create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = p_workspace_id
      and m.user_id = auth.uid()
      and m.role = 'OWNER'
  );
$$;

create or replace function public.shares_workspace_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
revoke all on function public.shares_workspace_with(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;
grant execute on function public.shares_workspace_with(uuid) to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_workspace_with(id));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy workspaces_select on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

create policy workspaces_update_owner on public.workspaces
  for update to authenticated
  using (public.is_workspace_owner(id))
  with check (public.is_workspace_owner(id));

create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy skills_select on public.skills
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy skills_insert_owner on public.skills
  for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy skills_update_owner on public.skills
  for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy skills_delete_owner on public.skills
  for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy areas_select on public.areas
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy areas_insert_owner on public.areas
  for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy areas_update_owner on public.areas
  for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy areas_delete_owner on public.areas
  for delete to authenticated
  using (public.is_workspace_owner(workspace_id));

create policy player_skills_select_self on public.player_skills
  for select to authenticated
  using (user_id = auth.uid());

create policy missions_select on public.missions
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (
      created_by = auth.uid()
      or assigned_to = auth.uid()
      or public.is_workspace_owner(workspace_id)
    )
  );

create policy missions_insert on public.missions
  for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and created_by = auth.uid()
    and (assigned_to = auth.uid() or public.is_workspace_owner(workspace_id))
  );

create policy missions_update on public.missions
  for update to authenticated
  using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_workspace_owner(workspace_id)
  )
  with check (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or public.is_workspace_owner(workspace_id)
  );

create policy missions_delete on public.missions
  for delete to authenticated
  using (created_by = auth.uid() or public.is_workspace_owner(workspace_id));

create policy mission_subtasks_select on public.mission_subtasks
  for select to authenticated
  using (
    exists (
      select 1 from public.missions m
      where m.id = mission_subtasks.mission_id
        and (
          m.created_by = auth.uid()
          or m.assigned_to = auth.uid()
          or public.is_workspace_owner(m.workspace_id)
        )
    )
  );

create policy mission_subtasks_insert on public.mission_subtasks
  for insert to authenticated
  with check (
    exists (
      select 1 from public.missions m
      where m.id = mission_subtasks.mission_id
        and (
          m.created_by = auth.uid()
          or m.assigned_to = auth.uid()
          or public.is_workspace_owner(m.workspace_id)
        )
        and m.completed_at is null
    )
  );

create policy mission_subtasks_update on public.mission_subtasks
  for update to authenticated
  using (
    exists (
      select 1 from public.missions m
      where m.id = mission_subtasks.mission_id
        and (
          m.created_by = auth.uid()
          or m.assigned_to = auth.uid()
          or public.is_workspace_owner(m.workspace_id)
        )
    )
  )
  with check (
    exists (
      select 1 from public.missions m
      where m.id = mission_subtasks.mission_id
        and m.completed_at is null
    )
  );

create policy mission_subtasks_delete on public.mission_subtasks
  for delete to authenticated
  using (
    exists (
      select 1 from public.missions m
      where m.id = mission_subtasks.mission_id
        and (m.created_by = auth.uid() or public.is_workspace_owner(m.workspace_id))
        and m.completed_at is null
    )
  );

create policy mission_completions_select_self on public.mission_completions
  for select to authenticated
  using (user_id = auth.uid());

create policy wallet_transactions_select_self on public.wallet_transactions
  for select to authenticated
  using (user_id = auth.uid());

create policy purchases_select_self on public.purchases
  for select to authenticated
  using (user_id = auth.uid());

create policy consumable_activations_select_self on public.consumable_activations
  for select to authenticated
  using (user_id = auth.uid());

create policy store_items_select on public.store_items
  for select to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (active = true or public.is_workspace_owner(workspace_id))
  );

create policy store_items_insert_owner on public.store_items
  for insert to authenticated
  with check (public.is_workspace_owner(workspace_id));

create policy store_items_update_owner on public.store_items
  for update to authenticated
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy store_items_delete_owner on public.store_items
  for delete to authenticated
  using (public.is_workspace_owner(workspace_id));
