create type public.app_role as enum ('admin','operador');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "ver proprio papel" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_operador()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'operador') or public.has_role(auth.uid(),'admin')
$$;

create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique,
  categoria text not null,
  prioridade text not null default 'media',
  nome text not null,
  telefone text not null,
  endereco text not null,
  descricao text not null,
  status text not null default 'pendente',
  viatura text,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant insert on public.ocorrencias to anon, authenticated;
grant select, update on public.ocorrencias to authenticated;
grant all on public.ocorrencias to service_role;
alter table public.ocorrencias enable row level security;
create policy "cidadao registra" on public.ocorrencias for insert to anon, authenticated
  with check (status = 'pendente' and viatura is null
    and length(nome) between 1 and 120 and length(telefone) between 1 and 40
    and length(endereco) between 1 and 300 and length(descricao) between 1 and 2000);
create policy "operador le" on public.ocorrencias for select to authenticated using (public.is_operador());
create policy "operador atualiza" on public.ocorrencias for update to authenticated using (public.is_operador()) with check (public.is_operador());

create or replace function public.touch_updated() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger ocorrencias_touch before update on public.ocorrencias for each row execute function public.touch_updated();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles(user_id, role) values (new.id,'admin'),(new.id,'operador');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter publication supabase_realtime add table public.ocorrencias;