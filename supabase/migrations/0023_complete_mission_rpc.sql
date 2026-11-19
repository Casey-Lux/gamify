create or replace function public.complete_mission(p_mission_id uuid)
returns table (
  mission_id          uuid,
  completed_at        timestamptz,
  base_xp             integer,
  xp_multiplier       numeric,
  xp_flat_bonus       integer,
  xp_awarded          integer,
  base_coins          integer,
  coin_multiplier     numeric,
  coin_flat_bonus     integer,
  coins_awarded       integer,
  player_total_xp     integer,
  player_level        integer,
  player_leveled_up   boolean,
  player_coins        integer,
  skill_id            uuid,
  skill_xp            integer,
  skill_level         integer,
  skill_leveled_up    boolean
)
language plpgsql
security definer
set search_path = public
as $$

#variable_conflict use_column
declare

  v_user_id uuid := auth.uid();

  v_mission public.missions;

  v_xp_multiplier   numeric(6,2) := 1.00;
  v_coin_multiplier numeric(6,2) := 1.00;
  v_xp_flat_bonus   integer := 0;
  v_coin_flat_bonus integer := 0;

  v_base_xp        integer;
  v_base_coins     integer;
  v_xp_awarded     integer;
  v_coins_awarded  integer;

  v_player_level_before integer;
  v_player_level_after  integer;
  v_player_total_xp_after integer;
  v_player_coins_after  integer;

  v_skill_level_before integer;
  v_skill_level_after  integer;
  v_skill_xp_after     integer;

  v_completed_at timestamptz;
begin

  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'GM001';
  end if;

  select *
  into v_mission
  from public.missions
  where id = p_mission_id
  for update;

  if v_mission.id is null then
    raise exception 'mission not found' using errcode = 'GM003';
  end if;

  if v_mission.assigned_to <> v_user_id then
    raise exception 'not authorized to complete this mission' using errcode = 'GM002';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_mission.workspace_id and user_id = v_user_id
  ) then
    raise exception 'not authorized to complete this mission' using errcode = 'GM002';
  end if;

  if v_mission.completed_at is not null then
    raise exception 'mission is already completed' using errcode = 'GM004';
  end if;

  if exists (
    select 1 from public.mission_subtasks ms
    where ms.mission_id = p_mission_id and ms.completed = false
  ) then
    raise exception 'mission has incomplete subtasks' using errcode = 'GM005';
  end if;

  perform 1 from public.profiles where id = v_user_id for update;

  select effect_value into v_xp_multiplier
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'XP_MULTIPLIER' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_xp_multiplier := coalesce(v_xp_multiplier, 1.00);

  select effect_value into v_coin_multiplier
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'COIN_MULTIPLIER' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_coin_multiplier := coalesce(v_coin_multiplier, 1.00);

  select effect_value into v_xp_flat_bonus
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'XP_FLAT_BONUS' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_xp_flat_bonus := coalesce(v_xp_flat_bonus, 0);

  select effect_value into v_coin_flat_bonus
  from public.consumable_activations
  where user_id = v_user_id and effect_type = 'COIN_FLAT_BONUS' and expires_at > now()
  order by activated_at desc
  limit 1;
  v_coin_flat_bonus := coalesce(v_coin_flat_bonus, 0);

  v_base_xp := v_mission.xp_reward;
  v_base_coins := v_mission.coin_reward;

  v_xp_awarded := round(v_base_xp * v_xp_multiplier)::integer + v_xp_flat_bonus;
  v_coins_awarded := round(v_base_coins * v_coin_multiplier)::integer + v_coin_flat_bonus;

  if v_xp_awarded < 0 or v_coins_awarded < 0 then
    raise exception 'computed reward must not be negative' using errcode = 'GM008';
  end if;

  update public.missions m
  set completed_at = now()
  where m.id = p_mission_id
  returning m.completed_at into v_completed_at;

  insert into public.mission_completions (
    mission_id, user_id, skill_id,
    base_xp, xp_multiplier, xp_flat_bonus, xp_awarded,
    base_coins, coin_multiplier, coin_flat_bonus, coins_awarded
  )
  values (
    p_mission_id, v_user_id, v_mission.skill_id,
    v_base_xp, v_xp_multiplier, v_xp_flat_bonus, v_xp_awarded,
    v_base_coins, v_coin_multiplier, v_coin_flat_bonus, v_coins_awarded
  );

  select level into v_player_level_before from public.profiles where id = v_user_id;

  update public.profiles
  set total_xp = total_xp + v_xp_awarded,
      coins = coins + v_coins_awarded
  where id = v_user_id
  returning total_xp, level, coins
  into v_player_total_xp_after, v_player_level_after, v_player_coins_after;

  select ps.level into v_skill_level_before
  from public.player_skills ps
  where ps.user_id = v_user_id and ps.skill_id = v_mission.skill_id;
  v_skill_level_before := coalesce(v_skill_level_before, 1);

  insert into public.player_skills (user_id, skill_id, xp)
  values (v_user_id, v_mission.skill_id, v_xp_awarded)
  on conflict (user_id, skill_id)
  do update set xp = public.player_skills.xp + excluded.xp
  returning xp, level
  into v_skill_xp_after, v_skill_level_after;

  if v_coins_awarded <> 0 then
    insert into public.wallet_transactions (user_id, amount, transaction_type, source_type, source_id)
    values (v_user_id, v_coins_awarded, 'MISSION_REWARD', 'mission', p_mission_id);
  end if;

  return query
  select
    p_mission_id,
    v_completed_at,
    v_base_xp,
    v_xp_multiplier,
    v_xp_flat_bonus,
    v_xp_awarded,
    v_base_coins,
    v_coin_multiplier,
    v_coin_flat_bonus,
    v_coins_awarded,
    v_player_total_xp_after,
    v_player_level_after,
    v_player_level_after > v_player_level_before,
    v_player_coins_after,
    v_mission.skill_id,
    v_skill_xp_after,
    v_skill_level_after,
    v_skill_level_after > v_skill_level_before;
end;
$$;

comment on function public.complete_mission(uuid) is
  'THE only way a mission ever gets marked completed and its rewards ever '
  'granted. Atomic (single function call = single transaction), race-safe '
  '(SELECT ... FOR UPDATE + a UNIQUE constraint as a second line of '
  'defense), and re-validates subtask completeness server-side regardless '
  'of what the frontend''s Complete button shows.';

revoke all on function public.complete_mission(uuid) from public;
grant execute on function public.complete_mission(uuid) to authenticated;
