-- Restrict SECURITY DEFINER helpers that do not need to be invoked through the public API.
-- Trigger execution does not require callers to hold EXECUTE on the trigger function.
revoke execute on function public.create_operator_profile_from_auth() from public, anon, authenticated;
revoke execute on function public.guard_cad_delete() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Role predicates are used by authenticated RLS policies, but never need anonymous execution.
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

revoke execute on function public.is_operador() from public, anon;
grant execute on function public.is_operador() to authenticated, service_role;
