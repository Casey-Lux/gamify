-- =============================================================================
-- 0011_store_items.sql
-- spec section 14 "Tienda" + section 15 "Efectos"
-- =============================================================================

create table public.store_items (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces (id) on delete cascade,
  name             text not null,
  description      text,
  price            integer not null,
  stock            integer not null default 5,
  max_stock        integer not null default 5,
  effect_type      public.effect_type not null,
  effect_value     numeric(6,2) not null,
  duration_minutes integer not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint store_items_name_not_blank check (length(trim(name)) > 0),
  constraint store_items_price_non_negative check (price >= 0),
  constraint store_items_stock_non_negative check (stock >= 0),
  constraint store_items_stock_within_max check (stock <= max_stock),
  -- "max_stock = 5 en MVP" (spec section 14/45) — every item type is capped the
  -- same way; the column still exists (rather than a hardcoded literal) so a
  -- future MVP+ change is a data/config change, not a schema change.
  constraint store_items_max_stock_is_five check (max_stock = 5),
  constraint store_items_duration_range check (duration_minutes between 1 and 30),
  constraint store_items_effect_value_positive check (effect_value > 0)
);

comment on table public.store_items is
  'One row per item TYPE (not per unit) — "no existe límite de 5 tipos de item", '
  'only 5 units per type. stock is never directly client-settable (see '
  '0015_column_privileges.sql): it starts at max_stock via the column default and '
  'from then on is only mutated by the purchase_item RPC (Fase 6), which is the '
  'sole writer of the stock-depletion / +2-coin-price economics (spec section 19).';

create trigger store_items_set_updated_at
before update on public.store_items
for each row execute function public.set_updated_at();

alter table public.store_items enable row level security;
