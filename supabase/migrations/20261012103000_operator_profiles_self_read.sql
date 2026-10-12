-- Allow each authenticated operator to read only their own functional profile.
alter table public.operator_profiles enable row level security;

drop policy if exists "Operators can read own functional profile" on public.operator_profiles;
create policy "Operators can read own functional profile"
on public.operator_profiles
for select
to authenticated
using (user_id = auth.uid());

grant select on public.operator_profiles to authenticated;
