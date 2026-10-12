-- Each dispatched occurrence is owned by the operator who performed the dispatch.
-- Pending, unassigned occurrences remain available to all authorized operators.
-- Administrators retain unrestricted access.

alter table public.ocorrencias
  add column if not exists despachado_por uuid references auth.users(id) on delete set null;

create index if not exists ocorrencias_despachado_por_idx
  on public.ocorrencias (despachado_por);

-- Preserve ownership for historical dispatches where the audit trail identifies the dispatcher.
with primeiro_despacho as (
  select distinct on (ocorrencia_id)
    ocorrencia_id,
    operador_id
  from public.ocorrencia_historico
  where status_novo = 'em_atendimento'
  order by ocorrencia_id, criado_em asc
)
update public.ocorrencias o
set despachado_por = d.operador_id
from primeiro_despacho d
where o.id = d.ocorrencia_id
  and o.status <> 'pendente'
  and o.despachado_por is null;

alter table public.ocorrencias enable row level security;
alter table public.ocorrencia_historico enable row level security;

-- Restrictive policies narrow any existing permissive policies.
drop policy if exists occurrences_operator_scope on public.ocorrencias;
create policy occurrences_operator_scope
on public.ocorrencias as restrictive
for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
  or (status = 'pendente' and despachado_por is null)
  or despachado_por = auth.uid()
);

drop policy if exists occurrences_operator_update_scope on public.ocorrencias;
create policy occurrences_operator_update_scope
on public.ocorrencias as restrictive
for update to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
  or (status = 'pendente' and despachado_por is null)
  or despachado_por = auth.uid()
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
  or (status = 'pendente' and despachado_por is null)
  or (status = 'cancelada' and despachado_por is null)
  or (despachado_por = auth.uid() and status in ('despachada','em_atendimento','encerrada','cancelada'))
);

drop policy if exists occurrence_history_operator_scope on public.ocorrencia_historico;
create policy occurrence_history_operator_scope
on public.ocorrencia_historico as restrictive
for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
  or exists (
    select 1 from public.ocorrencias o
    where o.id = ocorrencia_historico.ocorrencia_id
      and (
        (o.status = 'pendente' and o.despachado_por is null)
        or o.despachado_por = auth.uid()
      )
  )
);

drop policy if exists occurrence_history_operator_insert_scope on public.ocorrencia_historico;
create policy occurrence_history_operator_insert_scope
on public.ocorrencia_historico as restrictive
for insert to authenticated
with check (
  operador_id = auth.uid()
  and (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role::text = 'admin'
    )
    or exists (
      select 1 from public.ocorrencias o
      where o.id = ocorrencia_historico.ocorrencia_id
        and (
          (o.status = 'pendente' and o.despachado_por is null)
          or o.despachado_por = auth.uid()
        )
    )
  )
);
