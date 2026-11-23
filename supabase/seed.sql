-- Demo "Barbearia Exemplo". Idempotente: limpa os dados de demo e recria.
-- Agendamentos são relativos a now(), para a agenda parecer viva em qualquer dia.
delete from public.appointments;
delete from public.time_blocks;
delete from public.working_hours;
delete from public.services;
delete from public.barbers;
delete from public.settings;

insert into public.settings (id, shop_name, whatsapp, address, min_advance_min, booking_window_days)
values (1, 'Barbearia Exemplo', '11900000000', 'Rua Exemplo, 123 — Centro', 60, 30);

insert into public.barbers (id, name, sort_order) values
  ('00000000-0000-0000-0000-0000000000a1', 'Rafael', 1),
  ('00000000-0000-0000-0000-0000000000b2', 'Diego', 2);

insert into public.services (id, name, duration_min, price_cents, sort_order) values
  ('00000000-0000-0000-0000-00000000c001', 'Corte', 30, 4500, 1),
  ('00000000-0000-0000-0000-00000000c002', 'Barba', 20, 3000, 2),
  ('00000000-0000-0000-0000-00000000c003', 'Corte + Barba', 50, 7000, 3),
  ('00000000-0000-0000-0000-00000000c004', 'Pezinho', 15, 1500, 4),
  ('00000000-0000-0000-0000-00000000c005', 'Sobrancelha', 15, 1500, 5);

-- terça (2) a sábado (6): 09:00–12:00 e 13:00–19:00
insert into public.working_hours (barber_id, weekday, start_time, end_time)
select b.id, d, t.s, t.e
from public.barbers b
cross join generate_series(2, 6) d
cross join (values ('09:00'::time, '12:00'::time), ('13:00'::time, '19:00'::time)) t(s, e);

-- ~40% da grade ocupada nos próximos 5 dias úteis (a partir de amanhã)
with days as (
  select (now() at time zone 'America/Sao_Paulo')::date + i as d
  from generate_series(1, 9) i
  where extract(dow from (now() at time zone 'America/Sao_Paulo')::date + i) between 2 and 6
  order by 1 limit 5
),
slots as (
  select b.id as barber_id, d.d, hs.h
  from public.barbers b, days d,
       (select time '09:00' + make_interval(mins => 30 * k) as h from generate_series(0, 19) k) hs
  where hs.h < time '11:45' or hs.h >= time '13:00'
),
names(n, i) as (
  select n, row_number() over () from unnest(array[
    'Lucas Almeida','Pedro Santos','Gabriel Costa','Mateus Oliveira','Bruno Lima','Thiago Souza',
    'Felipe Rocha','André Martins','Rodrigo Pereira','Gustavo Ribeiro','Vinícius Carvalho','Leonardo Gomes'
  ]) n
)
insert into public.appointments (barber_id, service_id, customer_name, customer_phone, period, status, source)
select s.barber_id,
       case when abs(hashtext(s.barber_id::text || s.d || s.h)) % 3 = 0
            then '00000000-0000-0000-0000-00000000c003'::uuid
            else '00000000-0000-0000-0000-00000000c001'::uuid end,
       nm.n,
       '119' || lpad((abs(hashtext(s.d::text || s.h)) % 100000000)::text, 8, '0'),
       tstzrange(
         ((s.d + s.h) at time zone 'America/Sao_Paulo'),
         ((s.d + s.h) at time zone 'America/Sao_Paulo') +
           case when abs(hashtext(s.barber_id::text || s.d || s.h)) % 3 = 0 then interval '50 minutes' else interval '30 minutes' end,
         '[)'),
       'confirmed',
       case when abs(hashtext(s.h::text || s.d)) % 4 = 0 then 'manual' else 'online' end
from slots s
join names nm on nm.i = 1 + abs(hashtext(s.barber_id::text || s.h || s.d)) % 12
where abs(hashtext('demo' || s.barber_id || s.d || s.h)) % 10 < 4
  -- 50 min não pode invadir o almoço nem passar das 19h
  and not (abs(hashtext(s.barber_id::text || s.d || s.h)) % 3 = 0 and (s.h = time '11:30' or s.h = time '18:30'))
on conflict do nothing;
