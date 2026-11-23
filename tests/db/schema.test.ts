import { describe, expect, it } from 'vitest'
import type pg from 'pg'
import { withTestDb } from './harness'

async function seed(c: pg.Client) {
  const { rows: [a] } = await c.query(`insert into barbers(name) values ('A') returning id`)
  const { rows: [b] } = await c.query(`insert into barbers(name) values ('B') returning id`)
  const { rows: [s] } = await c.query(
    `insert into services(name, duration_min, price_cents) values ('Corte', 30, 4500) returning id`,
  )
  await c.query(`insert into services(name, duration_min, price_cents, active) values ('Antigo', 30, 1000, false)`)
  return { a: a.id as string, b: b.id as string, s: s.id as string }
}

const appt = (c: pg.Client, barber: string, service: string, range: string, status = 'confirmed') =>
  c.query(
    `insert into appointments(barber_id, service_id, customer_name, customer_phone, period, status, source)
     values ($1, $2, 'Cliente', '11987654321', $3::tstzrange, $4, 'online')`,
    [barber, service, range, status],
  )

const R = (from: string, to: string) => `[2026-12-07 ${from}-03, 2026-12-07 ${to}-03)`

describe('anti-duplicidade', () => {
  it('rejeita sobreposição confirmada no mesmo barbeiro com 23P01', () =>
    withTestDb(async (c) => {
      const { a, s } = await seed(c)
      await appt(c, a, s, R('10:00', '10:30'))
      await expect(appt(c, a, s, R('10:15', '10:45'))).rejects.toMatchObject({ code: '23P01' })
    }))
  it('cancelado não bloqueia', () =>
    withTestDb(async (c) => {
      const { a, s } = await seed(c)
      await appt(c, a, s, R('10:00', '10:30'), 'cancelled')
      await appt(c, a, s, R('10:15', '10:45'))
    }))
  it('horários encostados são permitidos', () =>
    withTestDb(async (c) => {
      const { a, s } = await seed(c)
      await appt(c, a, s, R('10:00', '10:30'))
      await appt(c, a, s, R('10:30', '11:00'))
    }))
  it('barbeiros diferentes no mesmo horário são permitidos', () =>
    withTestDb(async (c) => {
      const { a, b, s } = await seed(c)
      await appt(c, a, s, R('10:00', '10:30'))
      await appt(c, b, s, R('10:00', '10:30'))
    }))
})

describe('RLS', () => {
  it('anon não lê agendamentos e só vê serviços ativos', () =>
    withTestDb(async (c) => {
      const { a, s } = await seed(c)
      await appt(c, a, s, R('10:00', '10:30'))
      await c.query('set role anon')
      expect((await c.query('select * from appointments')).rowCount).toBe(0)
      expect((await c.query('select name from services')).rows).toEqual([{ name: 'Corte' }])
      await expect(appt(c, a, s, R('11:00', '11:30'))).rejects.toThrow()
    }))
  it('owner autenticado vê agendamentos; autenticado sem perfil não vê', () =>
    withTestDb(async (c) => {
      const { a, s } = await seed(c)
      await appt(c, a, s, R('10:00', '10:30'))
      const owner = '11111111-1111-1111-1111-111111111111'
      const stranger = '22222222-2222-2222-2222-222222222222'
      await c.query(`insert into auth.users(id) values ($1), ($2)`, [owner, stranger])
      await c.query(`insert into profiles(user_id, role) values ($1, 'owner')`, [owner])
      await c.query('set role authenticated')
      await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [owner])
      expect((await c.query('select * from appointments')).rowCount).toBe(1)
      await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [stranger])
      expect((await c.query('select * from appointments')).rowCount).toBe(0)
    }))
})

describe('hardening', () => {
  it('is_staff não fica exposta em public e a constraint continua valendo', () =>
    withTestDb(async (c) => {
      const r = await c.query(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where p.proname = 'is_staff' and n.nspname = 'public'`)
      expect(r.rows[0].n).toBe(0)
      const { a, s } = await seed(c)
      await appt(c, a, s, R('10:00', '10:30'))
      await expect(appt(c, a, s, R('10:15', '10:45'))).rejects.toMatchObject({ code: '23P01' })
    }))
})
