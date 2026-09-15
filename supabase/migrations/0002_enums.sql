-- =============================================================================
-- 0002_enums.sql
-- Closed enum types. Keeping these as real Postgres enums (rather than free text
-- + check constraints) gives us a single authoritative, non-extensible list for
-- each concept, per "no permitir código arbitrario / fórmulas personalizadas".
-- =============================================================================

-- Roles within a workspace. MVP only: no additional roles (spec section 4).
create type public.workspace_role as enum ('OWNER', 'MEMBER');

-- Mission difficulty (spec section 9).
create type public.mission_difficulty as enum ('EASY', 'MEDIUM', 'HARD');

-- Closed set of consumable effect types (spec section 15). Every effect is one of
-- these four, deterministic, server-validated kinds — never arbitrary code.
create type public.effect_type as enum (
  'XP_MULTIPLIER',
  'COIN_MULTIPLIER',
  'XP_FLAT_BONUS',
  'COIN_FLAT_BONUS'
);

-- Lifecycle status of a consumable activation (spec section 16).
create type public.activation_status as enum ('ACTIVE', 'EXPIRED');

-- Wallet ledger entry types (spec section 12).
create type public.wallet_transaction_type as enum (
  'MISSION_REWARD',
  'ITEM_PURCHASE',
  'ADMIN_ADJUSTMENT'
);
