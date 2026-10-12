-- Allow multiple authentication accounts to share one functional operator profile.
-- Each action remains audited against the actual authenticated auth.users.id.
create table if not exists public.operator_profile_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_user_id uuid not null references public.operator_profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint operator_profile_accounts_not_self check (user_id <> profile_user_id)
);

create index if not exists operator_profile_accounts_profile_user_id_idx
  on public.operator_profile_accounts (profile_user_id);

alter table public.operator_profile_accounts enable row level security;
revoke all on public.operator_profile_accounts from anon, authenticated;

-- The signed-in user can resolve their own functional identity without gaining
-- direct access to another account's profile row.
create or replace function public.get_my_operator_profile()
returns table (
  nome_completo text,
  matricula text,
  cargo text,
  lotacao text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  return query
    select p.nome_completo, p.matricula, p.cargo, p.lotacao
    from public.operator_profiles p
    where p.user_id = auth.uid()
    limit 1;

  if found then
    return;
  end if;

  return query
    select p.nome_completo, p.matricula, p.cargo, p.lotacao
    from public.operator_profile_accounts a
    join public.operator_profiles p on p.user_id = a.profile_user_id
    where a.user_id = auth.uid()
    limit 1;
end;
$$;

revoke all on function public.get_my_operator_profile() from public, anon;
grant execute on function public.get_my_operator_profile() to authenticated;

-- Only an authorized CAD administrator may create or change account links.
create or replace function public.admin_link_operator_account(
  _user_id uuid,
  _profile_user_id uuid
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

  if _user_id is null or _profile_user_id is null or _user_id = _profile_user_id then
    raise exception 'Informe duas contas distintas.';
  end if;

  if not exists (select 1 from auth.users where id = _user_id)
     or not exists (select 1 from public.operator_profiles where user_id = _profile_user_id) then
    raise exception 'Conta de acesso ou perfil funcional não encontrado.';
  end if;

  insert into public.operator_profile_accounts (user_id, profile_user_id)
  values (_user_id, _profile_user_id)
  on conflict (user_id) do update
    set profile_user_id = excluded.profile_user_id;
end;
$$;

revoke all on function public.admin_link_operator_account(uuid, uuid) from public, anon;
grant execute on function public.admin_link_operator_account(uuid, uuid) to authenticated;
