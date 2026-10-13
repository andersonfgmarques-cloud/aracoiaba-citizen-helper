-- Keep the Storage policy helper outside the exposed public API schema.
drop policy if exists "Only token-bound domestic violence protocols can upload measures" on storage.objects;
drop policy if exists "Only existing domestic violence protocols can upload measures" on storage.objects;
drop policy if exists "Public can upload protective measure files" on storage.objects;

drop function if exists public.can_upload_protective_measure(text);
drop function if exists public.can_upload_protective_measure(text, text);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.can_upload_protective_measure(_protocol text, _token text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.ocorrencias o
    where o.protocolo = _protocol
      and o.categoria in ('Violência doméstica', 'Descumprimento de medida protetiva de urgência')
      and o.anexo_token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
      and _token ~ '^[a-f0-9]{32}$'
  );
$$;

revoke all on function private.can_upload_protective_measure(text, text) from public;
grant execute on function private.can_upload_protective_measure(text, text) to anon, authenticated;

create policy "Only token-bound domestic violence protocols can upload measures"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'gcm-medidas-protetivas'
  and (storage.foldername(name))[1] ~ '^GCM-[0-9]{4}-[0-9]{6}$'
  and (storage.foldername(name))[2] ~ '^[a-f0-9]{32}$'
  and private.can_upload_protective_measure(
    (storage.foldername(name))[1],
    (storage.foldername(name))[2]
  )
);

-- Direct document mutation remains server-only.
revoke all on function public.attach_protective_measure_document(text, text) from public;
revoke all on function public.attach_protective_measure_document(text, text) from anon, authenticated;
grant execute on function public.attach_protective_measure_document(text, text) to service_role;
