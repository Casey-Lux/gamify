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
