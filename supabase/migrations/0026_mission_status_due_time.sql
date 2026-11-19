create type public.mission_status as enum ('TODO', 'DOING', 'DONE');

alter table public.missions
  add column status public.mission_status not null default 'TODO',
  add column due_has_time boolean not null default true;

alter table public.missions disable trigger missions_set_updated_at;
update public.missions
set status = case when completed_at is not null then 'DONE'::public.mission_status
                  else 'DOING'::public.mission_status end;
alter table public.missions enable trigger missions_set_updated_at;

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

  if new.completed_at is not null then
    if old.completed_at is null then

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

grant update (status, due_has_time) on public.missions to authenticated;
