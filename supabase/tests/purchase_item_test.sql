-- =============================================================================
-- supabase/tests/purchase_item_test.sql
-- Fase 12 — spec sección 44 "Database tests": purchase_item, insufficient
-- funds, stock limit, price increase, effect replacement.
--
-- Requires _harness.sql and every migration already applied (see
-- run_db_tests.sh). Wrapped in BEGIN/ROLLBACK: leaves no data behind.
-- =============================================================================
begin;

do $$
declare
  v_buyer    uuid := '00000000-0000-0000-0000-0000000000c1';
  v_outsider uuid := '00000000-0000-0000-0000-0000000000c2'; -- not a member of the item's workspace
  v_ws       uuid;
  v_item     uuid;
  v_row      record;
  v_activation_1 uuid;
  v_coins    integer;
begin
  -- -------------------------------------------------------------------
  -- fixtures
  -- -------------------------------------------------------------------
  perform tests.create_user(v_buyer, 'pi-buyer@test.dev', 'Buyer');
  perform tests.create_user(v_outsider, 'pi-outsider@test.dev', 'Outsider');

  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'PI Workspace', false, v_buyer)
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, v_buyer, 'OWNER');

  update public.profiles set coins = 1000 where id = v_buyer;

  insert into public.store_items
    (id, workspace_id, name, price, stock, effect_type, effect_value, duration_minutes)
  values
    (gen_random_uuid(), v_ws, 'XP Potion', 20, 5, 'XP_MULTIPLIER', 1.5, 10)
  returning id into v_item;

  -- =====================================================================
  -- GM001: not authenticated.
  -- =====================================================================
  perform tests.become_authenticated_without_claim();
  perform tests.assert_raises(
    format('select public.purchase_item(%L::uuid)', v_item),
    'GM001', 'GM001: no auth.uid()'
  );
  perform tests.logout();

  -- =====================================================================
  -- GM003: item does not exist.
  -- =====================================================================
  perform tests.login_as(v_buyer);
  perform tests.assert_raises(
    'select public.purchase_item(''00000000-0000-0000-0000-000000000000''::uuid)',
    'GM003', 'GM003: item not found'
  );

  -- =====================================================================
  -- GM002: authenticated, but not a member of the item's workspace.
  -- =====================================================================
  perform tests.logout();
  perform tests.login_as(v_outsider);
  perform tests.assert_raises(
    format('select public.purchase_item(%L::uuid)', v_item),
    'GM002', 'GM002: not a workspace member'
  );

  -- =====================================================================
  -- GM003 (inactive item): a member CAN see it deactivated, but the RPC
  -- still refuses to sell it.
  -- =====================================================================
  perform tests.logout();
  update public.store_items set active = false where id = v_item;
  perform tests.login_as(v_buyer);
  perform tests.assert_raises(
    format('select public.purchase_item(%L::uuid)', v_item),
    'GM003', 'GM003: item inactive'
  );
  perform tests.logout();
  update public.store_items set active = true where id = v_item;

  -- =====================================================================
  -- GM007: out of stock (forced directly — the RPC's own stock-reset
  -- logic never actually leaves stock at 0 under normal operation, so this
  -- exercises the defensive check itself, spec section 45's own "stock
  -- >= 0" boundary).
  -- =====================================================================
  update public.store_items set stock = 0 where id = v_item;
  perform tests.login_as(v_buyer);
  perform tests.assert_raises(
    format('select public.purchase_item(%L::uuid)', v_item),
    'GM007', 'GM007: out of stock'
  );
  perform tests.logout();
  update public.store_items set stock = 5 where id = v_item;

  -- =====================================================================
  -- GM006: insufficient funds.
  -- =====================================================================
  update public.profiles set coins = 5 where id = v_buyer; -- item costs 20
  perform tests.login_as(v_buyer);
  perform tests.assert_raises(
    format('select public.purchase_item(%L::uuid)', v_item),
    'GM006', 'GM006: insufficient funds'
  );
  perform tests.logout();
  update public.profiles set coins = 1000 where id = v_buyer;

  -- =====================================================================
  -- Exact economic cycle from spec section 19's own worked example: price
  -- 20, 5 units -> after the 5th purchase, stock resets to 5 and price
  -- becomes 22; a second cycle of 5 purchases at 22 -> stock resets again
  -- and price becomes 24. Verified purchase-by-purchase, not just at the
  -- end, so a wrong intermediate step can't hide behind a lucky final
  -- number.
  -- =====================================================================
  perform tests.login_as(v_buyer);

  select * into v_row from public.purchase_item(v_item); -- 1st: price 20
  assert v_row.price_paid = 20, format('purchase 1: expected price_paid 20, got %s', v_row.price_paid);
  assert v_row.new_stock = 4, format('purchase 1: expected stock 4, got %s', v_row.new_stock);
  assert v_row.new_price = 20, format('purchase 1: expected price still 20, got %s', v_row.new_price);

  select * into v_row from public.purchase_item(v_item); -- 2nd
  assert v_row.new_stock = 3, format('purchase 2: expected stock 3, got %s', v_row.new_stock);
  assert v_row.new_price = 20, format('purchase 2: expected price still 20, got %s', v_row.new_price);

  select * into v_row from public.purchase_item(v_item); -- 3rd
  assert v_row.new_stock = 2, format('purchase 3: expected stock 2, got %s', v_row.new_stock);

  select * into v_row from public.purchase_item(v_item); -- 4th
  assert v_row.new_stock = 1, format('purchase 4: expected stock 1, got %s', v_row.new_stock);

  select * into v_row from public.purchase_item(v_item); -- 5th: stock hits 0 -> resets to 5, price +2
  assert v_row.price_paid = 20, format('purchase 5: expected price_paid 20 (the price BEFORE the increase), got %s', v_row.price_paid);
  assert v_row.new_stock = 5, format('purchase 5: expected stock reset to 5, got %s', v_row.new_stock);
  assert v_row.new_price = 22, format('purchase 5: expected price increased to 22, got %s', v_row.new_price);

  -- second cycle at the new price (22)
  select * into v_row from public.purchase_item(v_item); -- 6th: 1st of cycle 2
  assert v_row.price_paid = 22, format('purchase 6: expected price_paid 22, got %s', v_row.price_paid);
  assert v_row.new_stock = 4, format('purchase 6: expected stock 4, got %s', v_row.new_stock);

  perform public.purchase_item(v_item); -- 7th
  perform public.purchase_item(v_item); -- 8th
  perform public.purchase_item(v_item); -- 9th

  select * into v_row from public.purchase_item(v_item); -- 10th: 5th of cycle 2 -> reset again, price 24
  assert v_row.new_stock = 5, format('purchase 10: expected stock reset to 5, got %s', v_row.new_stock);
  assert v_row.new_price = 24, format('purchase 10: expected price increased to 24, got %s', v_row.new_price);

  -- Coin ledger sanity: 5 * 20 + 5 * 22 = 210 spent so far, balance 1000 - 210 = 790.
  select coins into v_coins from public.profiles where id = v_buyer;
  assert v_coins = 790, format('expected coin balance 790 after 10 purchases (5*20 + 5*22), got %s', v_coins);

  assert (select count(*) from public.purchases where user_id = v_buyer and item_id = v_item) = 10,
    'expected exactly 10 rows in purchases';
  assert (select count(*) from public.wallet_transactions where user_id = v_buyer and source_type = 'purchase') = 10,
    'expected exactly 10 ITEM_PURCHASE wallet_transactions rows';
  assert (select sum(amount) from public.wallet_transactions where user_id = v_buyer and source_type = 'purchase') = -210,
    'wallet ledger must sum to exactly -210 (never a separate, possibly-diverging total)';

  -- =====================================================================
  -- Effect replacement (spec section 17): buying the SAME effect_type
  -- again must end the previous activation, not stack with it — at most
  -- ONE activation of a given effect_type is ever active for a user at
  -- once.
  -- =====================================================================
  select * into v_row from public.purchase_item(v_item); -- 11th purchase -> 1st activation of this block
  v_activation_1 := v_row.activation_id;

  -- status = 'ACTIVE', not a timestamp comparison against this test
  -- transaction's own (frozen at BEGIN) now(): the RPC itself cuts a
  -- replaced activation's expires_at with clock_timestamp() (real wall
  -- time — see 0024_purchase_item_rpc.sql's own comment on why), which can
  -- land a hair after this test's frozen now(), making a timestamp-based
  -- check here unreliable. `status` is the RPC's own explicit, unambiguous
  -- answer to "is this active" and has no such clock-skew edge case.
  assert (
    select count(*) from public.consumable_activations
    where user_id = v_buyer and effect_type = 'XP_MULTIPLIER' and status = 'ACTIVE'
  ) = 1, 'expected exactly 1 active XP_MULTIPLIER activation after the 11th purchase';

  perform public.purchase_item(v_item); -- 12th purchase -> should replace, not stack

  assert (
    select count(*) from public.consumable_activations
    where user_id = v_buyer and effect_type = 'XP_MULTIPLIER' and status = 'ACTIVE'
  ) = 1, 'expected STILL exactly 1 active XP_MULTIPLIER activation after a 2nd purchase of the same effect_type';

  assert (
    select status from public.consumable_activations where id = v_activation_1
  ) = 'EXPIRED', 'the FIRST activation''s status must be flipped to EXPIRED at replacement time';

  raise notice 'purchase_item_test.sql: all assertions passed';
end;
$$;

rollback;
