create table public.consumable_activations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_id      uuid not null references public.store_items (id) on delete restrict,
  effect_type  public.effect_type not null,
  effect_value numeric(6,2) not null,
  activated_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  status       public.activation_status not null default 'ACTIVE',

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
