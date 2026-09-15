-- =============================================================================
-- 0001_extensions.sql
-- Fase 2: Supabase / migrations / enums / tables / constraints / indexes / RLS
-- =============================================================================
-- gen_random_uuid() is built into PostgreSQL core since v13 (which Supabase runs),
-- so no extension is strictly required for UUID generation. pgcrypto is enabled
-- defensively anyway since it is a common dependency and ships with Supabase by
-- default, and costs nothing to declare explicitly/idempotently here.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
