-- =============================================================================
-- 0024_purchase_item_rpc.sql
-- Fase 6 "Compra de item" — spec section 18/19
--
-- Implements, in exact order, the 14 steps listed in the spec:
--   1  autenticar usuario
--   2  bloquear store_item
--   3  comprobar active
--   4  comprobar stock > 0
--   5  bloquear/validar saldo del usuario
--   6  comprobar coins >= price
--   7  restar coins
--   8  restar stock
--   9  crear purchase
--   10 crear wallet_transaction ITEM_PURCHASE
--   11 crear consumable_activation
--   12 si stock == 0: stock = max_stock (5), price = price + 2
--   13 commit                          <- the whole function IS one transaction
--   14 devolver item, nuevo saldo y efecto activo
--
-- "Nunca permitir: saldo negativo, stock negativo, compras sin stock,
-- compras sin fondos, duplicación por condiciones de carrera": guaranteed
-- by locking BOTH the store_items row and the profiles row with
-- `SELECT ... FOR UPDATE` before checking/mutating either — a second
-- concurrent purchase of the same item, or a second concurrent purchase by
-- the same (cash-constrained) user, BLOCKS until the first transaction
-- commits, then re-reads the now-current stock/price/balance rather than a
-- stale value. "La modificación del stock y aumento de precio deben formar
-- parte de la misma transacción": both are written in a single UPDATE
-- statement below.
-- =============================================================================

create or replace function public.purchase_item(p_item_id uuid)
returns table (
  item_id           uuid,
  item_name         text,
  price_paid        integer,
  new_coin_balance  integer,
  new_stock         integer,
  new_price         integer,
  activation_id     uuid,
  effect_type       public.effect_type,
  effect_value      numeric,
  activated_at      timestamptz,
  expires_at        timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
-- Same rationale as complete_mission (0023): RETURNS TABLE columns become
-- implicit plpgsql variables that would otherwise collide with real table
-- columns of the same name (effect_type, expires_at) used inside this
-- function's own queries.
#variable_conflict use_column
declare
  v_user_id      uuid := auth.uid();
  v_item         public.store_items;
  v_price        integer;
  v_new_stock    integer;
  v_new_price    integer;
  v_purchase_id  uuid;
  v_activation_id uuid;
  v_activated_at timestamptz;
  v_expires_at   timestamptz;
  v_coins_before integer;
  v_coins_after  integer;
begin
  -- ---------------------------------------------------------------------
  -- 1. authenticate
  -- ---------------------------------------------------------------------
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'GM001';
  end if;

  -- ---------------------------------------------------------------------
  -- 2. lock the store_item row FIRST, so a second concurrent purchase of
  -- the same item blocks here until this transaction commits or rolls
  -- back, then re-reads the (possibly now-different) stock/price.
  -- ---------------------------------------------------------------------
  select * into v_item
  from public.store_items
  where id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'item not found' using errcode = 'GM003';
  end if;

  -- store_items has no client-facing RLS SELECT bypass inside a SECURITY
  -- DEFINER function, so authorization is re-checked explicitly here: only
  -- a member of the item's own workspace may buy it.
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_item.workspace_id and user_id = v_user_id
  ) then
    raise exception 'not authorized to purchase this item' using errcode = 'GM002';
  end if;

  -- ---------------------------------------------------------------------
  -- 3. active
  -- ---------------------------------------------------------------------
  if v_item.active = false then
    raise exception 'item is not available for purchase' using errcode = 'GM003';
  end if;

  -- ---------------------------------------------------------------------
  -- 4. stock > 0
  -- ---------------------------------------------------------------------
  if v_item.stock <= 0 then
    raise exception 'item is out of stock' using errcode = 'GM007';
  end if;

  v_price := v_item.price;

  -- ---------------------------------------------------------------------
  -- 5. lock the user's profile row (their coin balance).
  -- ---------------------------------------------------------------------
  select coins into v_coins_before
  from public.profiles
  where id = v_user_id
  for update;

  -- ---------------------------------------------------------------------
  -- 6. sufficient funds, checked against the just-locked, current balance
  -- (never a value read before the lock was acquired).
  -- ---------------------------------------------------------------------
  if v_coins_before < v_price then
    raise exception 'insufficient funds' using errcode = 'GM006';
  end if;

  -- ---------------------------------------------------------------------
  -- 7. subtract coins.
  -- ---------------------------------------------------------------------
  update public.profiles
  set coins = coins - v_price
  where id = v_user_id
  returning coins into v_coins_after;

  -- ---------------------------------------------------------------------
  -- 8 + 12. subtract stock, and — in the SAME statement — apply the
  -- stock-reset / +2-price economics if this purchase just emptied it.
  -- Spec section 19's worked example (price 20, 5 units -> after the 5th
  -- purchase: stock=5, price=22) is exactly this: decrement first, and
  -- if that decrement reaches 0, reset stock to max_stock and add 2 to
  -- price, all in the same UPDATE as part of the same transaction.
  -- ---------------------------------------------------------------------
  v_new_stock := v_item.stock - 1;
  v_new_price := v_item.price;

  if v_new_stock = 0 then
    v_new_stock := v_item.max_stock;
    v_new_price := v_item.price + 2;
  end if;

  update public.store_items
  set stock = v_new_stock,
      price = v_new_price
  where id = p_item_id;

  -- ---------------------------------------------------------------------
  -- 9. purchase record. Always the price actually paid THIS time
  -- (v_price, captured before any post-purchase price increase above),
  -- never the item's current (possibly now-higher) price.
  -- ---------------------------------------------------------------------
  insert into public.purchases (user_id, item_id, quantity, price_each, total_price)
  values (v_user_id, p_item_id, 1, v_price, v_price)
  returning id into v_purchase_id;

  -- ---------------------------------------------------------------------
  -- 10. wallet_transaction (negative: a purchase is a spend).
  -- ---------------------------------------------------------------------
  insert into public.wallet_transactions (user_id, amount, transaction_type, source_type, source_id)
  values (v_user_id, -v_price, 'ITEM_PURCHASE', 'purchase', v_purchase_id);

  -- ---------------------------------------------------------------------
  -- Effect replacement (spec section 17): a new activation of the SAME
  -- effect_type replaces (does not stack with) any still-active one for
  -- this user. Done here, at purchase time, rather than leaving it to
  -- "whichever query happens to look active later" — immediately end any
  -- currently-active same-type activation before creating the new one.
  --
  -- clock_timestamp(), NOT now(): now()/transaction_timestamp() is frozen
  -- at the START of this transaction, but the `for update` lock on
  -- store_items above can leave this transaction queued behind another
  -- concurrent purchase of the same item for a while before it even gets
  -- here. Two purchases of the same effect_type queued back-to-back by the
  -- store_items lock can therefore have transaction-start timestamps in
  -- the OPPOSITE order from the order they actually run/commit in — with
  -- now(), the second-to-run transaction could compute a cutoff earlier
  -- than the first-to-run transaction's own activated_at, violating
  -- consumable_activations_expiry_after_activation below (found by
  -- supabase/tests/concurrency_test.sh, Fase 12 — sequential tests never
  -- exercise the lock queue, so this never showed up there).
  -- clock_timestamp() reads the actual wall clock at the moment each
  -- statement runs, which is always monotonically ordered the same way
  -- the lock queue itself is.
  -- ---------------------------------------------------------------------
  update public.consumable_activations
  set status = 'EXPIRED',
      expires_at = least(consumable_activations.expires_at, clock_timestamp())
  where consumable_activations.user_id = v_user_id
    and consumable_activations.effect_type = v_item.effect_type
    and consumable_activations.expires_at > clock_timestamp();

  -- ---------------------------------------------------------------------
  -- 11. consumable_activation: consumed immediately, no inventory (spec
  -- section 14/16). expires_at is computed from the real-time server clock
  -- plus the item's duration — never from any client-supplied timestamp
  -- (spec section 33), and never from now()/transaction_timestamp() for
  -- the same lock-queueing reason as the replacement step just above.
  -- ---------------------------------------------------------------------
  v_activated_at := clock_timestamp();
  v_expires_at := v_activated_at + make_interval(mins => v_item.duration_minutes);

  insert into public.consumable_activations (
    user_id, item_id, effect_type, effect_value, activated_at, expires_at, status
  )
  values (
    v_user_id, p_item_id, v_item.effect_type, v_item.effect_value,
    v_activated_at, v_expires_at, 'ACTIVE'
  )
  returning id into v_activation_id;

  -- ---------------------------------------------------------------------
  -- 13. (implicit — the whole function is one transaction)
  -- 14. return item, new balance, and the new activation.
  -- ---------------------------------------------------------------------
  return query
  select
    p_item_id,
    v_item.name,
    v_price,
    v_coins_after,
    v_new_stock,
    v_new_price,
    v_activation_id,
    v_item.effect_type,
    v_item.effect_value,
    v_activated_at,
    v_expires_at;
end;
$$;

comment on function public.purchase_item(uuid) is
  'THE only way coins/stock/price/consumable_activations ever change from a '
  'purchase. Locks store_items then profiles (that fixed order matters for '
  'avoiding deadlocks if ever called alongside another multi-row-locking '
  'RPC), so concurrent purchases of the same item or by the same '
  'cash-constrained user are fully serialized rather than racing.';

revoke all on function public.purchase_item(uuid) from public;
grant execute on function public.purchase_item(uuid) to authenticated;
