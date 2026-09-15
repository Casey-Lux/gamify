-- =============================================================================
-- 0010_wallet_transactions.sql
-- spec section 12 "Monedas"
-- =============================================================================
-- Documented secondary decision: amount is a signed integer (positive for
-- income like MISSION_REWARD/ADMIN_ADJUSTMENT credits, negative for spend like
-- ITEM_PURCHASE), rather than an unsigned amount + separate direction column.
-- This is the simplest representation that still lets profiles.coins be
-- reconstructed/audited as sum(amount) for a given user.

create table public.wallet_transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete restrict,
  amount           integer not null,
  transaction_type public.wallet_transaction_type not null,
  source_type      text not null,
  source_id        uuid,
  created_at       timestamptz not null default now(),

  constraint wallet_transactions_amount_not_zero check (amount <> 0)
);

comment on table public.wallet_transactions is
  'Immutable ledger. No updated_at, no UPDATE/DELETE grants to the client. '
  'Only RPCs (complete_mission in Fase 5, purchase_item in Fase 6) insert here.';

alter table public.wallet_transactions enable row level security;
