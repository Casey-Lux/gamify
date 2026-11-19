create type public.workspace_role as enum ('OWNER', 'MEMBER');

create type public.mission_difficulty as enum ('EASY', 'MEDIUM', 'HARD');

create type public.effect_type as enum (
  'XP_MULTIPLIER',
  'COIN_MULTIPLIER',
  'XP_FLAT_BONUS',
  'COIN_FLAT_BONUS'
);

create type public.activation_status as enum ('ACTIVE', 'EXPIRED');

create type public.wallet_transaction_type as enum (
  'MISSION_REWARD',
  'ITEM_PURCHASE',
  'ADMIN_ADJUSTMENT'
);
