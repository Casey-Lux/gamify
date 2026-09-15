-- =============================================================================
-- 0012_consumable_activations.sql
-- spec section 16 "Consumibles" + section 17 "Efectos simultáneos"
-- =============================================================================
-- No inventory table exists on purpose ("No crear tabla inventory_items"): a
-- purchased item is consumed immediately and only ever produces a temporary
-- activation row. effect_type/effect_value are denormalized (copied) from the
-- store_item at purchase time so this row's meaning never changes even if the
-- item is edited or deactivated later — same immutability pattern as
-- mission_completions.

create table public.consumable_activations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      uuid not null references public.store_items (id) on delete restrict,
  effect_type  public.effect_type not null,
  effect_value numeric(6,2) not null,
  activated_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  status       public.activation_status not null default 'ACTIVE',

  -- >= rather than a strict >: replacing an activation (0024_purchase_item_rpc.sql,
  -- "effect replacement") cuts its expires_at short to `now()`, and within a
  -- single transaction `now()` is the transaction timestamp (constant for
  -- the whole transaction) — if a replacement purchase happens in the very
  -- same transaction as the original activation, activated_at and the new
  -- expires_at are bitwise identical. That is a real, if narrow, case (found
  -- by supabase/tests/purchase_item_test.sql, Fase 12), not just a same-row
  -- update to a lower value: representing "replaced instantly, effectively
  -- zero duration" as expires_at = activated_at is correct and must not be
  -- rejected — only expires_at < activated_at (an activation expiring
  -- before it started) is genuinely invalid data.
  constraint consumable_activations_expiry_after_activation check (expires_at >= activated_at),
  constraint consumable_activations_effect_value_positive check (effect_value > 0)
);

comment on table public.consumable_activations is
  'Whether an effect is "active" must always be decided from expires_at > NOW() '
  'using the PostgreSQL server clock (spec section 16/33), never from status '
  'alone or any client/device clock. status is a lazy/cosmetic marker that can '
  'be updated by a query or later maintenance job — it is never the source of '
  'truth for "is this effect active right now".';

alter table public.consumable_activations enable row level security;
