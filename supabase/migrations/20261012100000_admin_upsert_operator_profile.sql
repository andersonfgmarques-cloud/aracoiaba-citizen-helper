-- Allow the authorized CAD administrator to create/update operator functional profiles.
create or replace function public.admin_upsert_operator_profile(
  _user_id uuid,
  _nome_completo text,
  _matricula text,
  _cargo text,
  _lotacao text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  if _user_id is null
    or length(trim(coalesce(_nome_completo, ''))) < 3
    or length(trim(coalesce(_matricula, ''))) < 2
    or length(trim(coalesce(_cargo, ''))) < 2
    or length(trim(coalesce(_lotacao, ''))) < 2 then
    raise exception 'Preencha nome de guerra, RM, cargo/graduação e lotação.';
  end if;
  insert into public.operator_profiles (user_id, nome_completo, matricula, cargo, lotacao)
  values (_user_id, trim(_nome_completo), trim(_matricula), trim(_cargo), trim(_lotacao))
  on conflict (user_id) do update set
    nome_completo = excluded.nome_completo,
    matricula = excluded.matricula,
    cargo = excluded.cargo,
    lotacao = excluded.lotacao,
    updated_at = now();
end;
$$;
revoke all on function public.admin_upsert_operator_profile(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_upsert_operator_profile(uuid, text, text, text, text) to authenticated;
