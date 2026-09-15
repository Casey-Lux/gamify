-- =============================================================================
-- 0025_avatar_storage.sql
-- Fase 10 "avatar" — spec section 30 "Storage"
--
-- Bucket: avatars (private — read access is granted by policy below, not by
-- making the bucket public, since profiles_select already lets teammates see
-- each other's avatar_path and the avatar image itself should follow the
-- same visibility rule).
--
-- Path convention: the spec writes it as "avatars/{user_id}/avatar.webp".
-- Since "avatars" is already the bucket id, the bucket-relative object key
-- (storage.objects.name) actually stored is "{user_id}/avatar.webp" — the
-- "avatars/" prefix in the spec's example is just naming the bucket for
-- clarity, not a literal path segment inside it.
--
-- Extension is always .webp: the frontend (src/lib/api/avatar.ts) converts
-- every upload to WebP client-side before it ever reaches Storage, so the
-- path convention's fixed filename can be enforced by policy, not just by
-- convention.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- INSERT/UPDATE/DELETE: "un usuario solo pueda modificar su propio avatar"
-- (spec section 30) — the first path segment must equal the caller's own
-- auth.uid(), and the object must live in the avatars bucket.
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: mirrors profiles_select (0016) — the owner, or anyone who shares a
-- workspace with them, can view the avatar. Without this, a teammate would
-- see profiles.avatar_path but get a broken image for it.
create policy avatars_select_self_or_teammate on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.shares_workspace_with(((storage.foldername(name))[1])::uuid)
    )
  );
