-- =====================================================================
-- 0009: Private storage bucket for inspection photos
-- =====================================================================
-- Path layout: kh/{org_id}/{property_id}/{inspection_id}/{photo_id}.jpg
-- A path is only writable/readable by members of the org whose id is the
-- {org_id} segment (2nd path segment). Access to files is otherwise via
-- short-lived signed URLs.
--
-- storage.foldername(name) returns the path segments as a 1-based array:
--   foldername[1] = 'kh', foldername[2] = '{org_id}'
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('kh-photos', 'kh-photos', false)
on conflict (id) do nothing;

drop policy if exists kh_photos_tenant_read on storage.objects;
create policy kh_photos_tenant_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select current_org_ids())
  );

drop policy if exists kh_photos_tenant_insert on storage.objects;
create policy kh_photos_tenant_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select current_org_ids())
  );

drop policy if exists kh_photos_tenant_update on storage.objects;
create policy kh_photos_tenant_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select current_org_ids())
  );

drop policy if exists kh_photos_tenant_delete on storage.objects;
create policy kh_photos_tenant_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'kh-photos'
    and (storage.foldername(name))[2]::uuid in (select current_org_ids())
  );
