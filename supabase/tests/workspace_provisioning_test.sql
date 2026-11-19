begin;

do $$
declare
  v_user_named   uuid := '00000000-0000-0000-0000-0000000000f1';
  v_user_no_name uuid := '00000000-0000-0000-0000-0000000000f2';
  v_ws_count     integer;
  v_ws           record;
  v_member       record;
begin

  perform tests.create_user(v_user_named, 'wp-named@test.dev', 'Nadia');

  select count(*) into v_ws_count
  from public.workspaces
  where created_by = v_user_named and is_personal;
  assert v_ws_count = 1,
    format('expected exactly 1 personal workspace for a new user, got %s', v_ws_count);

  select * into v_ws from public.workspaces where created_by = v_user_named and is_personal;
  assert v_ws.name = 'Nadia', format('expected workspace name ''Nadia'', got %L', v_ws.name);

  select * into v_member
  from public.workspace_members
  where workspace_id = v_ws.id and user_id = v_user_named;
  assert v_member.role = 'OWNER',
    format('expected the new user to be OWNER of their own personal workspace, got %L', v_member.role);

  perform tests.create_user(v_user_no_name, 'wp-no-name@test.dev', null);

  select * into v_ws from public.workspaces where created_by = v_user_no_name and is_personal;
  assert v_ws.name = 'wp-no-name',
    format('expected workspace name ''wp-no-name'' (email local-part fallback), got %L', v_ws.name);

  perform tests.login_as(v_user_named);
  perform tests.assert_raises(
    format('select public.create_workspace(%L, true)', 'Second personal'),
    '23505',
    'a user must not be able to create a second personal workspace'
  );
  perform tests.logout();

  raise notice 'workspace_provisioning_test.sql: all assertions passed';
end;
$$;

rollback;
