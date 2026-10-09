GRANT INSERT ON public.ocorrencias TO anon;
GRANT SELECT, INSERT, UPDATE ON public.ocorrencias TO authenticated;
GRANT ALL ON public.ocorrencias TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;