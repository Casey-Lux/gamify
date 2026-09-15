-- =============================================================================
-- 0021_level_sync_triggers.sql
-- Fase 4 "skills, player_skills, level calculation"
-- =============================================================================
-- profiles.level and player_skills.level are stored (denormalized) columns —
-- the spec's own table definitions list "level" explicitly as a column, not
-- just a derived read-time value — but they must NEVER drift from what
-- calculate_level(xp) says. Rather than trusting every future writer (RPCs
-- in Fase 5/6, admin tools, etc.) to remember to also set level correctly,
-- a BEFORE trigger recomputes it from xp on every write. This makes it
-- structurally impossible for level to disagree with xp, no matter what
-- touches the row.

create or replace function public.sync_profile_level()
returns trigger
language plpgsql
as $$
begin
  new.level := public.calculate_level(new.total_xp);
  return new;
end;
$$;

create trigger profiles_before_write_sync_level
before insert or update of total_xp on public.profiles
for each row execute function public.sync_profile_level();

create or replace function public.sync_player_skill_level()
returns trigger
language plpgsql
as $$
begin
  new.level := public.calculate_level(new.xp);
  return new;
end;
$$;

create trigger player_skills_before_write_sync_level
before insert or update of xp on public.player_skills
for each row execute function public.sync_player_skill_level();
