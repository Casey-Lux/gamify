-- =============================================================================
-- 0013_purchases.sql
-- spec section 20 "Purchases"
-- =============================================================================

create table public.purchases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete restrict,
  item_id     uuid not null references public.store_items (id) on delete restrict,
  quantity    integer not null default 1,
  price_each  integer not null,
  total_price integer not null,
  created_at  timestamptz not null default now(),

  constraint purchases_quantity_is_one check (quantity = 1),
  constraint purchases_price_each_non_negative check (price_each >= 0),
  constraint purchases_total_price_non_negative check (total_price >= 0),
  constraint purchases_total_matches_price check (total_price = price_each * quantity)
);

comment on table public.purchases is
  'Immutable purchase history: always records the price actually paid at the '
  'time, independent of the item''s current (possibly higher) price.';

alter table public.purchases enable row level security;
