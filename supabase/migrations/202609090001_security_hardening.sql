-- Phase 2 security hardening: profiles are private until a deliberately
-- column-limited discovery API is introduced with the matching service.

drop policy if exists "Authenticated users can discover profiles" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);
