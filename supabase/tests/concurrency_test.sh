#!/usr/bin/env bash
# =============================================================================
# supabase/tests/concurrency_test.sh
# Fase 12 — spec sección 44 "Database tests": completado simultáneo, compra
# simultánea (carrera de fondos insuficientes).
#
# A single PL/pgSQL transaction can't simulate two requests racing each
# other — it's one session, executed serially. This launches real, separate
# `psql` OS processes in parallel against the SAME already-migrated
# database, each its own connection/transaction, which is the only way to
# genuinely exercise the `for update` row locks in complete_mission/
# purchase_item (0023/0024) under real concurrent load.
#
# Called by run_db_tests.sh with TEST_DB already set; can also be run
# directly against an existing, already-migrated database:
#   TEST_DB=gamify_test supabase/tests/concurrency_test.sh
# =============================================================================
set -euo pipefail

TEST_DB="${TEST_DB:-gamify_test}"
N=10

USER_A="00000000-0000-0000-0000-0000000000e1"   # completes the same mission N times in parallel
USER_B="00000000-0000-0000-0000-0000000000e2"   # buys the same item N times in parallel, funds for only 4

psql -v ON_ERROR_STOP=1 -X -q -d "$TEST_DB" <<SQL
select tests.create_user('$USER_A', 'cc-a@test.dev', 'ConcurrentA');
select tests.create_user('$USER_B', 'cc-b@test.dev', 'ConcurrentB');

do \$\$
declare
  v_ws uuid;
  v_skill uuid;
  v_mission uuid;
  v_item uuid;
begin
  insert into public.workspaces (id, name, is_personal, created_by)
  values (gen_random_uuid(), 'Concurrency Workspace', false, '$USER_A') returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, '$USER_A', 'OWNER'), (v_ws, '$USER_B', 'OWNER');

  insert into public.skills (id, workspace_id, name)
  values (gen_random_uuid(), v_ws, 'Concurrency') returning id into v_skill;

  insert into public.missions
    (id, workspace_id, created_by, assigned_to, skill_id, title, difficulty, xp_reward, coin_reward)
  values (gen_random_uuid(), v_ws, '$USER_A', '$USER_A', v_skill, 'Race me', 'EASY', 10, 5)
  returning id into v_mission;

  -- price 10, default stock 5 (must equal max_stock, which is
  -- hard-constrained to exactly 5 — spec section 14/45) — comfortably more
  -- than the 4 purchases this user can actually afford, so the race below
  -- is purely about coins running out, never about also hitting the
  -- stock-reset path.
  insert into public.store_items (id, workspace_id, name, price, effect_type, effect_value, duration_minutes)
  values (gen_random_uuid(), v_ws, 'Race Item', 10, 'XP_MULTIPLIER', 1.1, 10)
  returning id into v_item;

  -- Exactly enough for 4 of the N purchases attempted below.
  update public.profiles set coins = 40 where id = '$USER_B';

  -- Stash the ids where the shell can read them back. Cleared first so a
  -- re-run against an already-populated database (e.g. iterating on this
  -- script by hand) doesn't leave a stale extra row for the SELECT below
  -- to pick up.
  create table if not exists tests.concurrency_fixture (mission_id uuid, item_id uuid);
  delete from tests.concurrency_fixture;
  insert into tests.concurrency_fixture values (v_mission, v_item);
end;
\$\$;
SQL

read -r MISSION_ID ITEM_ID < <(
  psql -X -q -A -t -d "$TEST_DB" -c "select mission_id || ' ' || item_id from tests.concurrency_fixture"
)

echo "   mission=$MISSION_ID item=$ITEM_ID"

# ---------------------------------------------------------------------------
# Race 1: the SAME mission, completed $N times in parallel by its assignee.
# Expect exactly 1 success (spec: "solo un completado debe tener éxito").
# ---------------------------------------------------------------------------
echo "   racing complete_mission x$N on the same mission..."
mission_ok=0
for i in $(seq 1 "$N"); do
  (
    psql -v ON_ERROR_STOP=1 -X -q -d "$TEST_DB" -c "
      select tests.login_as('$USER_A');
      select public.complete_mission('$MISSION_ID'::uuid);
    " > "/tmp/cc_mission_$i.log" 2>&1
  ) &
done
wait

for i in $(seq 1 "$N"); do
  if grep -q "ERROR" "/tmp/cc_mission_$i.log"; then
    :
  else
    mission_ok=$((mission_ok + 1))
  fi
done

completions=$(psql -X -q -A -t -d "$TEST_DB" -c "select count(*) from public.mission_completions where mission_id = '$MISSION_ID'")
completions=$(echo "$completions" | tr -d '[:space:]')

echo "   -> $mission_ok/$N psql processes succeeded, $completions row(s) in mission_completions"
if [ "$mission_ok" -ne 1 ] || [ "$completions" -ne 1 ]; then
  echo "   FAILED: expected exactly 1 success and 1 mission_completions row"
  exit 1
fi

# ---------------------------------------------------------------------------
# Race 2: the SAME item, purchased $N times in parallel by a user who only
# has funds for 4 of them (price 10, balance 40). Expect exactly 4
# successes and the remaining N-4 to fail with GM006 — never a negative
# balance, and never more than 4 rows in `purchases`.
# ---------------------------------------------------------------------------
echo "   racing purchase_item x$N with funds for exactly 4..."
purchase_ok=0
for i in $(seq 1 "$N"); do
  (
    psql -v ON_ERROR_STOP=1 -X -q -d "$TEST_DB" -c "
      select tests.login_as('$USER_B');
      select public.purchase_item('$ITEM_ID'::uuid);
    " > "/tmp/cc_purchase_$i.log" 2>&1
  ) &
done
wait

for i in $(seq 1 "$N"); do
  if grep -q "ERROR" "/tmp/cc_purchase_$i.log"; then
    if ! grep -q "insufficient funds" "/tmp/cc_purchase_$i.log"; then
      echo "   FAILED: attempt $i failed with something other than GM006/insufficient funds:"
      cat "/tmp/cc_purchase_$i.log"
      exit 1
    fi
  else
    purchase_ok=$((purchase_ok + 1))
  fi
done

purchases=$(psql -X -q -A -t -d "$TEST_DB" -c "select count(*) from public.purchases where item_id = '$ITEM_ID'")
purchases=$(echo "$purchases" | tr -d '[:space:]')
final_coins=$(psql -X -q -A -t -d "$TEST_DB" -c "select coins from public.profiles where id = '$USER_B'")
final_coins=$(echo "$final_coins" | tr -d '[:space:]')

echo "   -> $purchase_ok/$N succeeded, $purchases row(s) in purchases, final balance $final_coins"
if [ "$purchase_ok" -ne 4 ] || [ "$purchases" -ne 4 ] || [ "$final_coins" -ne 0 ]; then
  echo "   FAILED: expected exactly 4 successes, 4 purchases rows, and a final balance of 0"
  exit 1
fi

rm -f /tmp/cc_mission_*.log /tmp/cc_purchase_*.log
