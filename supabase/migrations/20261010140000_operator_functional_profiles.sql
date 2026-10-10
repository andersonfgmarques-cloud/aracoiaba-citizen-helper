-- Operator functional profiles for the GCM CAD.
create table if not exists public.operator_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null,
  matricula text not null,
  cargo text not null,
  lotacao text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operator_profiles_nome_check check (length(trim(nome_completo)) between 3 and 160),
  constraint operator_profiles_matricula_check check (length(trim(matricula)) between 2 and 30),
  constraint operator_profiles_cargo_check check (length(trim(cargo)) between 2 and 80),
  constraint operator_profiles_lotacao_check check (length(trim(lotacao)) between 2 and 120)
);

create unique index if not exists operator_profiles_matricula_unique
  on public.operator_profiles (lower(trim(matricula)));

alter table public.operator_profiles enable row level security;
revoke all on public.operator_profiles from anon, authenticated;
grant select, insert, update on public.operator_profiles to authenticated;

drop policy if exists operator_profiles_read_own on public.operator_profiles;
create policy operator_profiles_read_own on public.operator_profiles
  for select to authenticated using (user_id = auth.uid());

drop policy if exists operator_profiles_insert_own on public.operator_profiles;
create policy operator_profiles_insert_own on public.operator_profiles
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists operator_profiles_update_own on public.operator_profiles;
create policy operator_profiles_update_own on public.operator_profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.set_operator_profile_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.nome_completo := trim(new.nome_completo);
  new.matricula := trim(new.matricula);
  new.cargo := trim(new.cargo);
  new.lotacao := trim(new.lotacao);
  return new;
end;
$$;

drop trigger if exists operator_profiles_updated_at on public.operator_profiles;
create trigger operator_profiles_updated_at before update on public.operator_profiles
for each row execute function public.set_operator_profile_updated_at();

-- Create a profile from the registration metadata, before the account can be used.
create or replace function public.create_operator_profile_from_auth()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_matricula text;
  v_cargo text;
  v_lotacao text;
begin
  v_nome := trim(coalesce(new.raw_user_meta_data ->> 'nome_completo', ''));
  v_matricula := trim(coalesce(new.raw_user_meta_data ->> 'matricula', ''));
  v_cargo := trim(coalesce(new.raw_user_meta_data ->> 'cargo', ''));
  v_lotacao := trim(coalesce(new.raw_user_meta_data ->> 'lotacao', ''));

  if v_nome <> '' and v_matricula <> '' and v_cargo <> '' and v_lotacao <> '' then
    insert into public.operator_profiles (user_id, nome_completo, matricula, cargo, lotacao)
    values (new.id, v_nome, v_matricula, v_cargo, v_lotacao)
    on conflict (user_id) do update set
      nome_completo = excluded.nome_completo,
      matricula = excluded.matricula,
      cargo = excluded.cargo,
      lotacao = excluded.lotacao;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_operator_profile on auth.users;
create trigger on_auth_user_created_operator_profile
after insert on auth.users
for each row execute function public.create_operator_profile_from_auth();

create or replace function public.admin_list_operator_profiles()
returns table (
  user_id uuid,
  nome_completo text,
  matricula text,
  cargo text,
  lotacao text,
  email text,
  updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  return query
    select p.user_id, p.nome_completo, p.matricula, p.cargo, p.lotacao,
           u.email::text, p.updated_at
    from public.operator_profiles p
    join auth.users u on u.id = p.user_id
    order by p.nome_completo;
end;
$$;

revoke all on function public.admin_list_operator_profiles() from public, anon;
grant execute on function public.admin_list_operator_profiles() to authenticated;
