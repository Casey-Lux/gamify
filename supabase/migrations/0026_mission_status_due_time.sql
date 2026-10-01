-- =============================================================================
-- 0026_mission_status_due_time.sql
-- Mission workflow status (to-do / doing / done) + optional due *time*.
--
-- 1) missions.status
--    'vencida' is deliberately NOT a stored status: it is a derived condition
--    ("not completed AND due date has passed"), so it can never go stale. It
--    stays computed from due_at / due_has_time / completed_at (frontend:
--    src/lib/utils/format.ts `isOverdue`, and the `OVERDUE` filter in
--    src/lib/api/missions.ts).
--
--    DONE is tied 1:1 to completed_at, and completed_at is only ever set by
--    the complete_mission RPC (0023), so a client can never mark a mission
--    DONE by itself (that would skip the reward flow). A BEFORE trigger keeps
--    both in sync, which means complete_mission does not need to be rewritten.
--
-- 2) missions.due_has_time
--    due_at stays a timestamptz (sorting, indexing and filtering unchanged).
--    due_has_time = false means "the user only picked a day": due_at then
--    holds that day's local midnight purely as an anchor for ordering, and
--    no time of day is ever shown or assumed for it. Such a mission is
--    overdue only once that whole day has passed.
-- =============================================================================

create type public.mission_status as enum ('TODO', 'DOING', 'DONE');

alter table public.missions
  add column status public.mission_status not null default 'TODO',
  add column due_has_time boolean not null default true;

-- Backfill: completed missions are DONE; every other existing mission was
-- already "in play", so DOING keeps it visible in the default (doing) view.
-- updated_at is not touched by this one-off backfill.
alter table public.missions disable trigger missions_set_updated_at;
update public.missions
set status = case when completed_at is not null then 'DONE'::public.mission_status
                  else 'DOING'::public.mission_status end;
alter table public.missions enable trigger missions_set_updated_at;

-- Existing due dates were always entered with a time (datetime-local).
-- due_has_time therefore defaults to true; missions without a due date
-- don't use the flag.
alter table public.missions
  add constraint missions_due_time_needs_due_date
  check (due_at is not null or due_has_time = true);

comment on column public.missions.status is
  'Workflow status. DONE <=> completed_at is not null (enforced by the '
  'missions_sync_status trigger). "Vencida" is derived, never stored.';
comment on column public.missions.due_has_time is
  'false = date-only deadline (due_at is only the local-midnight anchor of '
  'that day; no time of day is implied).';

create index missions_status_idx on public.missions (status);

-- ---------------------------------------------------------------------------
-- status <-> completed_at consistency
-- ---------------------------------------------------------------------------
create or replace function public.missions_sync_status()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.completed_at is not null then
      new.status := 'DONE';
    elsif new.status = 'DONE' then
      raise exception 'a mission can only be DONE through complete_mission';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.completed_at is not null then
    if old.completed_at is null then
      -- complete_mission just set completed_at: status follows automatically.
      new.status := 'DONE';
    elsif new.status <> 'DONE' then
      raise exception 'a completed mission cannot change status';
    end if;
  elsif new.status = 'DONE' then
    raise exception 'a mission can only be DONE through complete_mission';
  end if;

  return new;
end;
$$;

create trigger missions_sync_status_trg
before insert or update of status, completed_at on public.missions
for each row execute function public.missions_sync_status();

-- ---------------------------------------------------------------------------
-- Column privileges (see 0015): the client may edit status (the trigger above
-- stops it from reaching / leaving DONE) and due_has_time. Insert is already a
-- table-level grant.
-- ---------------------------------------------------------------------------
grant update (status, due_has_time) on public.missions to authenticated;
