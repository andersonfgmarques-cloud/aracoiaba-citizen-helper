-- Bind protective-measure uploads to a high-entropy per-submission token.
alter table public.ocorrencias
  add column if not exists anexo_token_hash text;

create or replace function public.can_upload_protective_measure(_protocol text, _token text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.ocorrencias o
    where o.protocolo = _protocol
      and o.categoria in ('Violência doméstica', 'Descumprimento de medida protetiva de urgência')
      and o.anexo_token_hash = encode(digest(_token, 'sha256'), 'hex')
      and _token ~ '^[a-f0-9]{32}$'
  );
$$;

revoke all on function public.can_upload_protective_measure(text) from public;
revoke all on function public.can_upload_protective_measure(text, text) from public;
grant execute on function public.can_upload_protective_measure(text, text) to anon, authenticated;

drop policy if exists "Public can upload protective measure files" on storage.objects;
drop policy if exists "Only existing domestic violence protocols can upload measures" on storage.objects;
create policy "Only token-bound domestic violence protocols can upload measures"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'gcm-medidas-protetivas'
  and (storage.foldername(name))[1] ~ '^GCM-[0-9]{4}-[0-9]{6}$'
  and (storage.foldername(name))[2] ~ '^[a-f0-9]{32}$'
  and (storage.foldername(name))[3] = ''
  and public.can_upload_protective_measure(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

-- Do not expose document-linking mutation as a public RPC. The Edge Function performs
-- the token check and update using its server-only service role key.
revoke all on function public.attach_protective_measure_document(text, text) from public;
revoke all on function public.attach_protective_measure_document(text, text) from anon, authenticated;
grant execute on function public.attach_protective_measure_document(text, text) to service_role;
