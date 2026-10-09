-- Administrative controls for the GCM CAD.
-- The allowlisted email is an identity, never a password or secret.
create table if not exists public.cad_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text not null,
  action text not null,
  target_user_id uuid,
  occurrence_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.cad_admin_audit enable row level security;
revoke all on public.cad_admin_audit from anon, authenticated;

create or replace function public.is_cad_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'andersonf.g.marques@gmail.com'
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'admin'::public.app_role
    );
$$;

revoke all on function public.is_cad_admin() from public;
grant execute on function public.is_cad_admin() to authenticated;

-- Bootstrap the single designated administrator if the account already exists.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = 'andersonf.g.marques@gmail.com'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role = 'admin'::public.app_role
  );

-- The administrator also retains normal CAD operator access.
insert into public.user_roles (user_id, role)
select u.id, 'operador'::public.app_role
from auth.users u
where lower(u.email) = 'andersonf.g.marques@gmail.com'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role = 'operador'::public.app_role
  );

create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  -- If the designated administrator account was created after migration, bootstrap it on first use.
  if lower(coalesce(auth.jwt() ->> 'email', '')) = 'andersonf.g.marques@gmail.com' then
    insert into public.user_roles (user_id, role)
    select auth.uid(), 'admin'::public.app_role
    where auth.uid() is not null
      and not exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.role = 'admin'::public.app_role
      );
    insert into public.user_roles (user_id, role)
    select auth.uid(), 'operador'::public.app_role
    where auth.uid() is not null
      and not exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.role = 'operador'::public.app_role
      );
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    case
      when exists (select 1 from public.user_roles ur where ur.user_id = u.id and ur.role = 'admin'::public.app_role) then 'admin'
      when exists (select 1 from public.user_roles ur where ur.user_id = u.id and ur.role = 'operador'::public.app_role) then 'operador'
      else 'pendente'
    end::text
  from auth.users u
  order by u.created_at desc;
end;
$$;

create or replace function public.admin_set_operator_access(_user_id uuid, _enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  select u.email::text into v_email from auth.users u where u.id = _user_id;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  if lower(coalesce(v_email, '')) = 'andersonf.g.marques@gmail.com'
    or exists (select 1 from public.user_roles ur where ur.user_id = _user_id and ur.role = 'admin'::public.app_role) then
    raise exception 'A conta administrativa protegida não pode ser bloqueada por esta tela.';
  end if;

  if _enabled then
    insert into public.user_roles (user_id, role)
    select _user_id, 'operador'::public.app_role
    where not exists (
      select 1 from public.user_roles ur
      where ur.user_id = _user_id and ur.role = 'operador'::public.app_role
    );
  else
    delete from public.user_roles
    where user_id = _user_id and role = 'operador'::public.app_role;
  end if;

  insert into public.cad_admin_audit (actor_user_id, actor_email, action, target_user_id, details)
  values (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', 'administrador'),
    case when _enabled then 'operator_access_granted' else 'operator_access_revoked' end,
    _user_id,
    jsonb_build_object('target_email', v_email, 'enabled', _enabled)
  );
end;
$$;

create or replace function public.admin_list_occurrences()
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
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  return query
  select o.id, o.protocolo, o.categoria, o.status, o.created_at, o.viatura
  from public.ocorrencias o
  order by o.created_at desc
  limit 500;
end;
$$;

create or replace function public.admin_list_audit(_limit integer default 100)
returns table (
  id uuid,
  actor_email text,
  action text,
  target_user_id uuid,
  occurrence_id uuid,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  return query
  select a.id, a.actor_email, a.action, a.target_user_id, a.occurrence_id, a.details, a.created_at
  from public.cad_admin_audit a
  order by a.created_at desc
  limit greatest(1, least(coalesce(_limit, 100), 500));
end;
$$;

create or replace function public.guard_cad_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.cad_admin_delete', true) = 'on'
     and public.is_cad_admin() then
    return old;
  end if;
  raise exception 'Exclusão permitida somente pela rotina administrativa auditada.'
    using errcode = '42501';
end;
$$;

drop trigger if exists guard_cad_occurrence_delete on public.ocorrencias;
create trigger guard_cad_occurrence_delete
before delete on public.ocorrencias
for each row execute function public.guard_cad_delete();

drop trigger if exists guard_cad_history_delete on public.ocorrencia_historico;
create trigger guard_cad_history_delete
before delete on public.ocorrencia_historico
for each row execute function public.guard_cad_delete();

create or replace function public.admin_delete_occurrence(_occurrence_id uuid, _reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occurrence public.ocorrencias%rowtype;
  v_actor_email text;
  v_history_count integer;
begin
  if not public.is_cad_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;
  if length(trim(coalesce(_reason, ''))) < 5 then
    raise exception 'Informe um motivo de exclusão com pelo menos 5 caracteres.';
  end if;

  select * into v_occurrence
  from public.ocorrencias
  where id = _occurrence_id
  for update;

  if not found then
    raise exception 'Ocorrência não encontrada ou já excluída.';
  end if;

  select count(*) into v_history_count
  from public.ocorrencia_historico h
  where h.ocorrencia_id = _occurrence_id;

  v_actor_email := coalesce(auth.jwt() ->> 'email', 'administrador');

  insert into public.cad_admin_audit (
    actor_user_id, actor_email, action, occurrence_id, details
  ) values (
    auth.uid(),
    v_actor_email,
    'occurrence_deleted',
    _occurrence_id,
    jsonb_build_object(
      'reason', trim(_reason),
      'protocol', v_occurrence.protocolo,
      'category', v_occurrence.categoria,
      'status', v_occurrence.status,
      'created_at', v_occurrence.created_at,
      'history_records_deleted', v_history_count
    )
  );

  perform set_config('app.cad_admin_delete', 'on', true);
  delete from public.ocorrencia_historico where ocorrencia_id = _occurrence_id;
  delete from public.ocorrencias where id = _occurrence_id;

  return jsonb_build_object('deleted', true, 'protocol', v_occurrence.protocolo);
end;
$$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_operator_access(uuid, boolean) from public, anon;
revoke all on function public.admin_list_occurrences() from public, anon;
revoke all on function public.admin_list_audit(integer) from public, anon;
revoke all on function public.admin_delete_occurrence(uuid, text) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_operator_access(uuid, boolean) to authenticated;
grant execute on function public.admin_list_occurrences() to authenticated;
grant execute on function public.admin_list_audit(integer) to authenticated;
grant execute on function public.admin_delete_occurrence(uuid, text) to authenticated;
