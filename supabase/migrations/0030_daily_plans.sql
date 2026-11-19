create table public.daily_plan_settings (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  monday_hours numeric(4,1) not null default 0,
  tuesday_hours numeric(4,1) not null default 0,
  wednesday_hours numeric(4,1) not null default 0,
  thursday_hours numeric(4,1) not null default 0,
  friday_hours numeric(4,1) not null default 0,
  saturday_hours numeric(4,1) not null default 0,
  sunday_hours numeric(4,1) not null default 0,
  updated_at   timestamptz not null default now(),

  constraint daily_plan_settings_hours_range check (
    monday_hours between 0 and 24
    and tuesday_hours between 0 and 24
    and wednesday_hours between 0 and 24
    and thursday_hours between 0 and 24
    and friday_hours between 0 and 24
    and saturday_hours between 0 and 24
    and sunday_hours between 0 and 24
  )
);

create trigger daily_plan_settings_set_updated_at
before update on public.daily_plan_settings
for each row execute function public.set_updated_at();

alter table public.daily_plan_settings enable row level security;

create table public.daily_plans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  plan_date    date not null,
  hours        numeric(4,1) not null,
  slots        smallint not null,
  created_at   timestamptz not null default now(),

  constraint daily_plans_unique_per_day unique (user_id, workspace_id, plan_date),
  constraint daily_plans_hours_range check (hours between 0 and 24),
  constraint daily_plans_slots_range check (slots between 1 and 3)
);

alter table public.daily_plans enable row level security;

create table public.daily_plan_missions (
  plan_id    uuid not null references public.daily_plans (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  position   smallint not null,
  created_at timestamptz not null default now(),

  primary key (plan_id, mission_id),
  constraint daily_plan_missions_position_range check (position between 1 and 3),
  constraint daily_plan_missions_unique_position unique (plan_id, position)
);

alter table public.daily_plan_missions enable row level security;

create policy daily_plan_settings_select_self on public.daily_plan_settings
  for select to authenticated
  using (user_id = auth.uid());

create policy daily_plan_settings_insert_self on public.daily_plan_settings
  for insert to authenticated
  with check (user_id = auth.uid());

create policy daily_plan_settings_update_self on public.daily_plan_settings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy daily_plan_settings_delete_self on public.daily_plan_settings
  for delete to authenticated
  using (user_id = auth.uid());

create policy daily_plans_select_self on public.daily_plans
  for select to authenticated
  using (user_id = auth.uid());

create policy daily_plans_insert_self on public.daily_plans
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_workspace_member(workspace_id)
  );

create policy daily_plans_delete_self on public.daily_plans
  for delete to authenticated
  using (user_id = auth.uid());

create policy daily_plan_missions_select_self on public.daily_plan_missions
  for select to authenticated
  using (
    exists (
      select 1
      from public.daily_plans p
      where p.id = daily_plan_missions.plan_id
        and p.user_id = auth.uid()
    )
  );

create policy daily_plan_missions_insert_self on public.daily_plan_missions
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.daily_plans p
      where p.id = daily_plan_missions.plan_id
        and p.user_id = auth.uid()
    )
  );

create policy daily_plan_missions_delete_self on public.daily_plan_missions
  for delete to authenticated
  using (
    exists (
      select 1
      from public.daily_plans p
      where p.id = daily_plan_missions.plan_id
        and p.user_id = auth.uid()
    )
  );

revoke all on public.daily_plan_settings, public.daily_plans, public.daily_plan_missions
  from authenticated;
grant select, insert, update, delete on public.daily_plan_settings to authenticated;
grant select, insert, delete on public.daily_plans to authenticated;
grant select, insert, delete on public.daily_plan_missions to authenticated;

revoke all on public.daily_plan_settings, public.daily_plans, public.daily_plan_missions
  from anon;
