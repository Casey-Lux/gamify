-- =============================================================================
-- 0003_helper_functions.sql
-- Small, reusable, deterministic helper functions shared across tables.
-- =============================================================================

-- Generic "touch updated_at on write" trigger function, reused by every table
-- that has an updated_at column, so the rule is defined exactly once.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger: stamps updated_at = now() on every row write.';
