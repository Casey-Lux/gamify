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
