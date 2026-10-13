create or replace function public.admin_search_occurrences(_protocol text)
returns table (
  id uuid,
  protocolo text,
  categoria text,
  status text,
  created_at timestamptz,
  viatura text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_term text := trim(coalesce(_protocol, ''));
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  if length(v_term) < 3 then
    raise exception 'Informe pelo menos 3 caracteres do protocolo para pesquisar.';
  end if;

  return query
  select o.id, o.protocolo, o.categoria, o.status, o.created_at, o.viatura
  from public.ocorrencias o
  where upper(o.protocolo) like '%' || upper(v_term) || '%'
  order by o.created_at desc
  limit 200;
end;
$$;

revoke all on function public.admin_search_occurrences(text) from public, anon;
grant execute on function public.admin_search_occurrences(text) to authenticated;
