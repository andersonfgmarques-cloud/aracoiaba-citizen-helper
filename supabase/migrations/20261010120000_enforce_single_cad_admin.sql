-- Enforce a single designated administrator for the GCM CAD.
-- Authorization is based on the authenticated Supabase JWT email, not a mutable role row.
create or replace function public.is_cad_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'andersonf.g.marques@gmail.com';
$$;

revoke all on function public.is_cad_admin() from public, anon;
grant execute on function public.is_cad_admin() to authenticated;

-- Keep the protected administrator role assigned only to the designated account.
-- This does not grant admin privileges to anyone; it only removes stale admin-role rows.
delete from public.user_roles ur
where ur.role = 'admin'::public.app_role
  and not exists (
    select 1
    from auth.users u
    where u.id = ur.user_id
      and lower(coalesce(u.email, '')) = 'andersonf.g.marques@gmail.com'
  );

-- Ensure the designated account has both roles needed for normal CAD and administration.
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(coalesce(u.email, '')) = 'andersonf.g.marques@gmail.com'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role = 'admin'::public.app_role
  );

insert into public.user_roles (user_id, role)
select u.id, 'operador'::public.app_role
from auth.users u
where lower(coalesce(u.email, '')) = 'andersonf.g.marques@gmail.com'
  and not exists (
    select 1 from public.user_roles ur
    where ur.user_id = u.id and ur.role = 'operador'::public.app_role
  );
