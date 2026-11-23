-- Atende aos avisos de segurança do Supabase:
-- 1) is_staff() sai do schema exposto pela API (não vira /rpc/is_staff);
-- 2) btree_gist sai do schema public.
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_staff() returns boolean
  language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where user_id = auth.uid()) $$;
grant execute on function private.is_staff() to anon, authenticated;

drop policy barbers_public_read on public.barbers;
drop policy services_public_read on public.services;
drop policy barbers_staff_all on public.barbers;
drop policy services_staff_all on public.services;
drop policy settings_staff_all on public.settings;
drop policy working_hours_staff_all on public.working_hours;
drop policy time_blocks_staff_all on public.time_blocks;
drop policy appointments_staff_all on public.appointments;

create policy barbers_public_read on public.barbers for select using (active or private.is_staff());
create policy services_public_read on public.services for select using (active or private.is_staff());
create policy barbers_staff_all on public.barbers for all using (private.is_staff()) with check (private.is_staff());
create policy services_staff_all on public.services for all using (private.is_staff()) with check (private.is_staff());
create policy settings_staff_all on public.settings for all using (private.is_staff()) with check (private.is_staff());
create policy working_hours_staff_all on public.working_hours for all using (private.is_staff()) with check (private.is_staff());
create policy time_blocks_staff_all on public.time_blocks for all using (private.is_staff()) with check (private.is_staff());
create policy appointments_staff_all on public.appointments for all using (private.is_staff()) with check (private.is_staff());

create or replace function public.replace_working_hours(p_barber_id uuid, p_hours jsonb) returns void
  language plpgsql security invoker set search_path = public
as $$
begin
  if not private.is_staff() then raise exception 'forbidden'; end if;
  delete from public.working_hours where barber_id = p_barber_id;
  insert into public.working_hours (barber_id, weekday, start_time, end_time)
  select p_barber_id, (h->>'weekday')::smallint, (h->>'start')::time, (h->>'end')::time
  from jsonb_array_elements(p_hours) h;
end $$;

drop function public.is_staff();

create schema if not exists extensions;
alter extension btree_gist set schema extensions;
