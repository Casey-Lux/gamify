-- =============================================================================
-- supabase/tests/_harness.sql
-- Fase 12 — spec sección 44 "Database tests"
--
-- Every migration from 0004 onward assumes three things a real Supabase
-- project provides out of the box, which a plain local PostgreSQL does not:
--   1. An `auth` schema with a `users` table and an `auth.uid()` function.
--   2. A `storage` schema with `buckets`/`objects` tables, RLS-capable, plus
--      a `storage.foldername()` helper (needed by 0025_avatar_storage.sql).
--   3. The `anon` / `authenticated` / `service_role` Postgres roles that
--      PostgREST switches into per-request based on the caller's JWT.
--
-- This file stands all three in, reproducing the *real* Supabase
-- implementation (not a shortcut) so that testing against it means testing
-- the actual RLS/SECURITY DEFINER boundaries the app will run under in
-- production — `auth.uid()` below is verbatim how Supabase itself defines
-- it (reading the `request.jwt.claim.sub` GUC that PostgREST sets from the
-- caller's JWT), and `storage.foldername()` is verbatim Supabase Storage's
-- own implementation.
--
-- Must run BEFORE the migrations (0004_profiles.sql references auth.users;
-- 0025_avatar_storage.sql references storage.buckets/objects; 0015/0016
-- grant to / write policies "to authenticated").
--
-- Usage: see supabase/tests/run_db_tests.sh, which applies this, then every
-- migration, then every *_test.sql file, against a disposable database.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Roles. Real Supabase provisions these for every project; a plain
-- PostgreSQL does not. NOLOGIN: nothing ever connects directly *as* these
-- roles — a session connects as the superuser and does `SET ROLE`, exactly
-- like PostgREST does after validating a JWT (see tests.login_as below).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- auth schema (stand-in for supabase-auth / GoTrue's own schema).
-- ---------------------------------------------------------------------------
create schema if not exists auth;
grant usage on schema auth to anon, authenticated;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  -- Present only so seed.sql (which mirrors a real Supabase Auth insert,
  -- including a password hash) can run unmodified against this stand-in too;
  -- nothing under supabase/migrations ever reads either column.
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  created_at          timestamptz not null default now()
);

-- The real implementation (auth.uid(), from Supabase's own auth-schema.sql):
-- reads the `sub` claim PostgREST placed in `request.jwt.claim.sub` for this
-- request/transaction. `nullif(..., '')` matches production exactly — an
-- authenticated Postgres role with no claim set (the GM001 "not
-- authenticated" scenario, see tests.become_authenticated_without_claim
-- below) must see auth.uid() = null, not an empty-string cast error.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- storage schema (stand-in for supabase-storage's own schema), needed only
-- by 0025_avatar_storage.sql.
-- ---------------------------------------------------------------------------
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

-- Verbatim Supabase Storage's own implementation: splits "a/b/c.png" into
-- {a,b}, i.e. every path segment except the filename — used by
-- 0025_avatar_storage.sql's policies as `(storage.foldername(name))[1]`
-- to read the "{user_id}/avatar.webp" convention's first segment.
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

-- ---------------------------------------------------------------------------
-- tests schema: fixtures + role-switching helpers shared by every *_test.sql
-- file. Not part of the application schema — never applied to a real
-- Supabase project.
-- ---------------------------------------------------------------------------
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Inserts a row into auth.users, which fires 0018_auth_profile_provisioning's
-- trigger and creates the matching public.profiles row exactly like a real
-- sign-up would — fixtures go through the same path a real user does,
-- rather than inserting into public.profiles directly.
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

-- Switches the current session into the `authenticated` Postgres role and
-- sets the JWT `sub` claim `auth.uid()` reads — exactly what PostgREST does
-- after verifying a real JWT. Plain (non-LOCAL) SET/set_config, not
-- SET LOCAL: psql test scripts run as a sequence of autocommitted
-- statements (no surrounding BEGIN), and SET LOCAL's effect would vanish at
-- the end of the very statement that set it.
create or replace function tests.login_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  set role authenticated;
end;
$$;

-- The GM001 "not authenticated" case: connected as the `authenticated`
-- Postgres role (so table/function GRANTs are satisfied) but with no JWT
-- claim — auth.uid() is null, same as a real anonymous/expired session that
-- still reached an `authenticated`-role endpoint.
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

-- Always safe to call regardless of current role: RESET ROLE returns to the
-- session's own identity (the superuser that connected), which Postgres
-- permits unconditionally — it is returning to who you really are, never an
-- escalation.
create or replace function tests.logout()
returns void
language plpgsql
as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
end;
$$;

-- Runs p_sql and asserts it raises exactly p_expected_sqlstate. Used for
-- every "RPC must reject with GM00N" assertion so that pattern is written
-- once instead of repeated ad hoc try/catch blocks in every test file.
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

-- Asserts p_sql returns zero rows (used for "must not be visible under RLS"
-- assertions, as opposed to tests.assert_raises' "must be rejected").
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
