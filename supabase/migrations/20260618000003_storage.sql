-- Llave — Phase 0: Storage buckets + policies
-- Path convention:
--   public buckets:        {org_id}/<anything>
--   private (per-tenant):  {org_id}/{user_id}/<anything>
-- Staff manage everything under their own {org_id}/ prefix. Tenants read/write only
-- under their own {org_id}/{user_id}/ prefix in private buckets.

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',        'avatars',        true,  5242880,  array['image/png','image/jpeg','image/webp']),
  ('listing-photos', 'listing-photos', true,  10485760, array['image/png','image/jpeg','image/webp']),
  ('documents',      'documents',      false, 15728640, null),
  ('receipts',       'receipts',       false, 15728640, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Policies on storage.objects (RLS is already enabled by Supabase)
-- ---------------------------------------------------------------------------

-- Public buckets are world-readable.
create policy "public read public buckets"
  on storage.objects for select to anon, authenticated
  using (bucket_id in ('avatars', 'listing-photos'));

-- Staff: full control of any file under their org's prefix, in any bucket.
create policy "staff manage org files"
  on storage.objects for all to authenticated
  using (
    (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_staff()
  )
  with check (
    (storage.foldername(name))[1] = public.auth_org_id()::text
    and public.is_org_staff()
  );

-- Tenant: read their own private files at {org_id}/{user_id}/...
create policy "tenant read own private files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('documents', 'receipts')
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Tenant: upload their own files (e.g. maintenance photos) to documents/{org_id}/{user_id}/...
create policy "tenant upload own files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Tenant: replace/delete their own uploaded files.
create policy "tenant update own files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "tenant delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = public.auth_org_id()::text
    and (storage.foldername(name))[2] = auth.uid()::text
  );
