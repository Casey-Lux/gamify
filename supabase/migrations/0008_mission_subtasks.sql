-- =============================================================================
-- 0008_mission_subtasks.sql
-- spec section 10 "Submisiones"
-- =============================================================================

create table public.mission_subtasks (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references public.missions (id) on delete cascade,
  title        text not null,
  position     integer not null default 0,
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint mission_subtasks_title_not_blank check (length(trim(title)) > 0),
  constraint mission_subtasks_position_non_negative check (position >= 0),
  constraint mission_subtasks_completed_at_consistency check (
    (completed = false and completed_at is null) or
    (completed = true and completed_at is not null)
  )
);

comment on table public.mission_subtasks is
  'Subtasks never award XP/coins on their own (spec section 10). The '
  'complete_mission RPC (Fase 5) is expected to re-verify server-side that all '
  'subtasks of a mission are completed before awarding anything — the frontend '
  'disabling the Complete button is a UX convenience only, not the real gate.';

create trigger mission_subtasks_set_updated_at
before update on public.mission_subtasks
for each row execute function public.set_updated_at();

-- Keep completed_at consistent automatically rather than trusting the client
-- to send a matching timestamp: this is a small UX/data-quality nicety, not a
-- security boundary (the security boundary is complete_mission's own re-check).
create or replace function public.mission_subtasks_sync_completed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.completed = true then
      new.completed_at = coalesce(new.completed_at, now());
    else
      new.completed_at = null;
    end if;
    return new;
  end if;

  if new.completed = true and old.completed = false then
    new.completed_at = now();
  elsif new.completed = false and old.completed = true then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger mission_subtasks_before_insert_sync_completed_at
before insert on public.mission_subtasks
for each row execute function public.mission_subtasks_sync_completed_at();

create trigger mission_subtasks_before_update_sync_completed_at
before update of completed on public.mission_subtasks
for each row execute function public.mission_subtasks_sync_completed_at();

alter table public.mission_subtasks enable row level security;
