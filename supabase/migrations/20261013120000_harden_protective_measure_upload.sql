-- Harden protective-measure document upload and bind each object to an existing domestic-violence occurrence.
-- Files remain private; this migration does not change occurrence intake permissions.
create or replace function public.can_upload_protective_measure(_protocol text)
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
  );
$$;

revoke all on function public.can_upload_protective_measure(text) from public;
grant execute on function public.can_upload_protective_measure(text) to anon, authenticated;

drop policy if exists "Public can upload protective measure files" on storage.objects;
drop policy if exists "Only existing domestic violence protocols can upload measures" on storage.objects;
create policy "Only existing domestic violence protocols can upload measures"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'gcm-medidas-protetivas'
  and (storage.foldername(name))[1] ~ '^GCM-[0-9]{4}-[0-9]{6}$'
  and public.can_upload_protective_measure((storage.foldername(name))[1])
);

create or replace function public.attach_protective_measure_document(_protocol text, _path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if _protocol !~ '^GCM-[0-9]{4}-[0-9]{6}$'
     or _path is null
     or split_part(_path, '/', 1) <> _protocol
     or split_part(_path, '/', 2) = ''
     or split_part(_path, '/', 3) <> '' then
    raise exception 'Invalid protective-measure document reference';
  end if;

  if not exists (
    select 1 from storage.objects so
    where so.bucket_id = 'gcm-medidas-protetivas'
      and so.name = _path
  ) then
    raise exception 'Protective-measure object does not exist';
  end if;

  update public.ocorrencias
  set descricao = concat(
    rtrim(replace(descricao, '[ANEXO_MEDIDA_PROTETIVA: PENDENTE; ARQUIVO_SELECIONADO]', '')),
    E'\n[ANEXO_MEDIDA_PROTETIVA: path=', _path, ']'
  )
  where protocolo = _protocol
    and categoria in ('Violência doméstica', 'Descumprimento de medida protetiva de urgência')
    and descricao not like '%[ANEXO_MEDIDA_PROTETIVA: path=%';

  if not found then
    raise exception 'Occurrence not found, not eligible, or document already attached';
  end if;
end;
$$;

revoke all on function public.attach_protective_measure_document(text, text) from public;
grant execute on function public.attach_protective_measure_document(text, text) to anon, authenticated;
