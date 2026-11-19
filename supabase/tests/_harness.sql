do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,

  encrypted_password  text,
  email_confirmed_at  timestamptz,
  created_at          timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated;

create table if not exists storage.buckets (
  id         text primary key,
  name       text not null,
  public     boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text not null,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language plpgsql
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end;
$$;

grant select, insert, update, delete on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(
  p_id uuid,
  p_email text,
  p_display_name text default null
)
returns void
language sql
as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (
    p_id,
    p_email,
    case when p_display_name is null then '{}'::jsonb
         else jsonb_build_object('display_name', p_display_name) end
  )
  on conflict (id) do nothing;
$$;

create or replace function tests.login_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  set role authenticated;
end;
$$;

create or replace function tests.become_authenticated_without_claim()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  set role authenticated;
end;
$$;

create or replace function tests.login_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  set role anon;
end;
$$;

create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

create or replace function tests.assert_raises(
  p_sql text,
  p_expected_sqlstate text,
  p_context text
)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise exception '% : expected SQLSTATE % but no exception was raised',
    p_context, p_expected_sqlstate;
exception
  when others then
    if sqlstate <> p_expected_sqlstate then
      raise exception '% : expected SQLSTATE % but got % (%)',
        p_context, p_expected_sqlstate, sqlstate, sqlerrm;
    end if;
end;
$$;

create or replace function tests.assert_empty(p_sql text, p_context text)
returns void
language plpgsql
as $$
declare
  v_count integer;
begin
  execute format('select count(*) from (%s) as _t', p_sql) into v_count;
  if v_count <> 0 then
    raise exception '% : expected 0 rows, got %', p_context, v_count;
  end if;
end;
$$;
