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

  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'GM001';
  end if;

  select * into v_item
  from public.store_items
  where id = p_item_id
  for update;

  if v_item.id is null then
    raise exception 'item not found' using errcode = 'GM003';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_id = v_item.workspace_id and user_id = v_user_id
  ) then
    raise exception 'not authorized to purchase this item' using errcode = 'GM002';
  end if;

  if v_item.active = false then
    raise exception 'item is not available for purchase' using errcode = 'GM003';
  end if;

  if v_item.stock <= 0 then
    raise exception 'item is out of stock' using errcode = 'GM007';
  end if;

  v_price := v_item.price;

  select coins into v_coins_before
  from public.profiles
  where id = v_user_id
  for update;

  if v_coins_before < v_price then
    raise exception 'insufficient funds' using errcode = 'GM006';
  end if;

  update public.profiles
  set coins = coins - v_price
  where id = v_user_id
  returning coins into v_coins_after;

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

  insert into public.purchases (user_id, item_id, quantity, price_each, total_price)
  values (v_user_id, p_item_id, 1, v_price, v_price)
  returning id into v_purchase_id;

  insert into public.wallet_transactions (user_id, amount, transaction_type, source_type, source_id)
  values (v_user_id, -v_price, 'ITEM_PURCHASE', 'purchase', v_purchase_id);

  update public.consumable_activations
  set status = 'EXPIRED',
      expires_at = least(consumable_activations.expires_at, clock_timestamp())
  where consumable_activations.user_id = v_user_id
    and consumable_activations.effect_type = v_item.effect_type
    and consumable_activations.expires_at > clock_timestamp();

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
