-- ============================================================
-- Harden storage RLS for delivery-photos, reports and documents
-- buckets: the previous policies only checked bucket_id, so any
-- authenticated user (from any organisation) could list, download
-- or upload files belonging to any other organisation's locations.
--
-- This migration scopes select/insert to objects whose path starts
-- with (or contains, for "documents") a location id that belongs to
-- the caller's own organisation. The buckets remain public (no
-- change to existing getPublicUrl() usage, which does not go
-- through these policies), this only closes off direct Storage API
-- access (list / download / createSignedUrl / cross-org uploads).
-- ============================================================

-- Track the "documents" bucket (created manually in production;
-- used by ddd, mycie, orzeczenia, olej, odpady, badania-wody and
-- dostawy modules for PDF/document uploads).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', true)
on conflict do nothing;

-- ── delivery-photos: paths are "{locationId}/{module}/{file}" ──
drop policy if exists "delivery_photos_upload" on storage.objects;
drop policy if exists "delivery_photos_read" on storage.objects;

create policy "delivery_photos_select_org" on storage.objects
  for select using (
    bucket_id = 'delivery-photos'
    and (storage.foldername(name))[1] in (select id::text from public.locations where org_id = public.fn_my_org_id())
  );

create policy "delivery_photos_insert_org" on storage.objects
  for insert with check (
    bucket_id = 'delivery-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (select id::text from public.locations where org_id = public.fn_my_org_id())
  );

-- ── reports: paths are "{locationId}/{file}" ──
drop policy if exists "reports_upload" on storage.objects;
drop policy if exists "reports_read" on storage.objects;

create policy "reports_select_org" on storage.objects
  for select using (
    bucket_id = 'reports'
    and (storage.foldername(name))[1] in (select id::text from public.locations where org_id = public.fn_my_org_id())
  );

create policy "reports_insert_org" on storage.objects
  for insert with check (
    bucket_id = 'reports'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (select id::text from public.locations where org_id = public.fn_my_org_id())
  );

-- ── documents: paths are either "{locationId}/{module}/{file}"
--    (dostawy, odpady, badania-wody, olej) or
--    "{module}/{locationId}/{file}" (cleaning, ddd, medical) ──
drop policy if exists "documents_upload" on storage.objects;
drop policy if exists "documents_read" on storage.objects;

create policy "documents_select_org" on storage.objects
  for select using (
    bucket_id = 'documents'
    and (
      (storage.foldername(name))[1] in (select id::text from public.locations where org_id = public.fn_my_org_id())
      or (storage.foldername(name))[2] in (select id::text from public.locations where org_id = public.fn_my_org_id())
    )
  );

create policy "documents_insert_org" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] in (select id::text from public.locations where org_id = public.fn_my_org_id())
      or (storage.foldername(name))[2] in (select id::text from public.locations where org_id = public.fn_my_org_id())
    )
  );
