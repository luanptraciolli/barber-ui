-- Sistema de agendamento da barbearia: schema, anti-duplicidade e RLS.
create extension if not exists btree_gist;

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  active boolean not null default true,
  sort_order int not null default 0
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_min int not null check (duration_min > 0),
  price_cents int not null check (price_cents >= 0),
  active boolean not null default true,
  sort_order int not null default 0
);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index working_hours_barber_idx on public.working_hours(barber_id);

-- barber_id nulo = bloqueio da barbearia inteira
create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  check (ends_at > starts_at)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id),
  service_id uuid not null references public.services(id),
  customer_name text not null,
  customer_phone text not null,
  period tstzrange not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  source text not null check (source in ('online', 'manual')),
  created_at timestamptz not null default now(),
  constraint appointments_no_overlap
    exclude using gist (barber_id with =, period with &&) where (status = 'confirmed')
);
create index appointments_phone_idx on public.appointments(customer_phone);
create index appointments_period_idx on public.appointments using gist (period);

create table public.settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default '',
  whatsapp text not null default '',
  address text not null default '',
  logo_url text,
  min_advance_min int not null default 60,
  booking_window_days int not null default 30
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin'))
);

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where user_id = auth.uid()) $$;

-- RLS
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;

create policy barbers_public_read on public.barbers for select using (active or public.is_staff());
create policy services_public_read on public.services for select using (active or public.is_staff());
create policy settings_public_read on public.settings for select using (true);

create policy barbers_staff_all on public.barbers for all using (public.is_staff()) with check (public.is_staff());
create policy services_staff_all on public.services for all using (public.is_staff()) with check (public.is_staff());
create policy settings_staff_all on public.settings for all using (public.is_staff()) with check (public.is_staff());
create policy working_hours_staff_all on public.working_hours for all using (public.is_staff()) with check (public.is_staff());
create policy time_blocks_staff_all on public.time_blocks for all using (public.is_staff()) with check (public.is_staff());
create policy appointments_staff_all on public.appointments for all using (public.is_staff()) with check (public.is_staff());

create policy profiles_self_read on public.profiles for select using (user_id = auth.uid());

-- Substitui o expediente de um barbeiro de forma atômica (usado pelo painel).
create or replace function public.replace_working_hours(p_barber_id uuid, p_hours jsonb) returns void
  language plpgsql security invoker set search_path = public
as $$
begin
  if not public.is_staff() then raise exception 'forbidden'; end if;
  delete from public.working_hours where barber_id = p_barber_id;
  insert into public.working_hours (barber_id, weekday, start_time, end_time)
  select p_barber_id, (h->>'weekday')::smallint, (h->>'start')::time, (h->>'end')::time
  from jsonb_array_elements(p_hours) h;
end $$;
