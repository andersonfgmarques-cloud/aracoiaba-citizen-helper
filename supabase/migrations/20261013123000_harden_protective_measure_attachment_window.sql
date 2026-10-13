-- Further restrict anonymous attachment linking to a fresh upload for a recently created eligible occurrence.
-- The public intake remains anonymous, so require the object and occurrence to have been created in the same short window.
create or replace function public.attach_protective_measure_document(_protocol text, _path text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  _object_created_at timestamptz;
begin
  if _protocol !~ '^GCM-[0-9]{4}-[0-9]{6}$'
     or _path is null
     or split_part(_path, '/', 1) <> _protocol
     or split_part(_path, '/', 2) = ''
     or split_part(_path, '/', 3) <> '' then
    raise exception 'Invalid protective-measure document reference';
  end if;

  select so.created_at into _object_created_at
  from storage.objects so
  where so.bucket_id = 'gcm-medidas-protetivas'
    and so.name = _path;

  if _object_created_at is null
     or _object_created_at < now() - interval '15 minutes'
     or _object_created_at > now() then
    raise exception 'Protective-measure upload is missing or expired';
  end if;

  if exists (
    select 1
    from public.ocorrencias other_occurrence
    where other_occurrence.descricao like '%' || '[ANEXO_MEDIDA_PROTETIVA: path=' || _path || ']%'
  ) then
    raise exception 'Protective-measure object is already attached';
  end if;

  update public.ocorrencias o
  set descricao = concat(
    rtrim(replace(o.descricao, '[ANEXO_MEDIDA_PROTETIVA: PENDENTE; ARQUIVO_SELECIONADO]', '')),
    E'\n[ANEXO_MEDIDA_PROTETIVA: path=', _path, ']'
  )
  where o.protocolo = _protocol
    and o.categoria in ('Violência doméstica', 'Descumprimento de medida protetiva de urgência')
    and o.created_at >= now() - interval '30 minutes'
    and o.created_at <= _object_created_at
    and o.descricao not like '%[ANEXO_MEDIDA_PROTETIVA: path=%';

  if not found then
    raise exception 'Recent eligible occurrence not found or document already attached';
  end if;
end;
$$;

revoke all on function public.attach_protective_measure_document(text, text) from public;
grant execute on function public.attach_protective_measure_document(text, text) to anon, authenticated;
