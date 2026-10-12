-- Private storage for domestic-violence protective-measure documents.
-- Citizens may upload a supporting file to a protocol folder; only authorized CAD operators can read objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gcm-medidas-protetivas',
  'gcm-medidas-protetivas',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "Public can upload protective measure files" on storage.objects;
create policy "Public can upload protective measure files"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'gcm-medidas-protetivas'
  and (storage.foldername(name))[1] like 'GCM-%'
);

drop policy if exists "CAD operators can read protective measure files" on storage.objects;
create policy "CAD operators can read protective measure files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'gcm-medidas-protetivas'
  and public.is_operador()
);
