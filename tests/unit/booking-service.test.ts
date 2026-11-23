import { beforeEach, describe, expect, it } from 'vitest'
import { createBooking, getAvailableSlots, tryGetAvailableSlots } from '@/lib/booking/service'
import { atTime } from '@/lib/time'
import { MemoryRepo } from '../fakes/memory-repo'

const DAY = '2026-12-08' // terça
const NOW = new Date('2026-12-01T12:00:00Z')
let repo: MemoryRepo

beforeEach(() => {
  repo = new MemoryRepo()
  repo.barbers = [
    { id: 'a', name: 'Rafael', photoUrl: null },
    { id: 'b', name: 'Diego', photoUrl: null },
  ]
  repo.services = [{ id: 'corte', name: 'Corte', durationMin: 30, priceCents: 4500 }]
  const h = [{ weekday: 2, start: '09:00', end: '12:00' }, { weekday: 2, start: '13:00', end: '19:00' }]
  repo.hours = { a: h, b: h }
})

const book = (over: Partial<Parameters<typeof createBooking>[1]> = {}) =>
  createBooking(repo, {
    serviceId: 'corte', barberId: 'a', start: atTime(DAY, '10:00').toISOString(),
    customerName: 'João', customerPhone: '11987654321', now: NOW, source: 'online', ...over,
  })
const labels = async (barberId: string) =>
  (await getAvailableSlots(repo, { serviceId: 'corte', barberId, date: DAY, now: NOW })).map((s) => s.label)

describe('getAvailableSlots', () => {
  it('bloqueio geral (barberId null) remove horários dos dois barbeiros', async () => {
    repo.blocks = [{ barberId: null, start: atTime(DAY, '09:00'), end: atTime(DAY, '12:00') }]
    expect(await labels('a')).not.toContain('09:00')
    expect(await labels('b')).not.toContain('11:30')
    expect((await labels('any'))[0]).toBe('13:00')
  })
  it('agendamento cancelado libera o horário', async () => {
    await book()
    expect(await labels('a')).not.toContain('10:00')
    repo.appointments[0].status = 'cancelled'
    expect(await labels('a')).toContain('10:00')
  })
  it('data fora da janela retorna vazio', async () => {
    expect(await getAvailableSlots(repo, { serviceId: 'corte', barberId: 'a', date: '2027-02-02', now: NOW })).toEqual([])
    expect(await getAvailableSlots(repo, { serviceId: 'corte', barberId: 'a', date: '2026-11-24', now: NOW })).toEqual([])
  })
  it('rótulos em HH:mm no fuso de SP', async () => {
    expect((await labels('a'))[0]).toBe('09:00')
  })
})

describe('createBooking', () => {
  it('sem preferência vai para o barbeiro livre', async () => {
    await book({ barberId: 'a' })
    const r = await book({ barberId: 'any', customerPhone: '11911111111' })
    expect(r).toMatchObject({ ok: true, barberName: 'Diego' })
  })
  it('sem preferência com ambos livres vai para quem tem menos no dia', async () => {
    await book({ barberId: 'a', start: atTime(DAY, '15:00').toISOString() })
    const r = await book({ barberId: 'any', customerPhone: '11911111111' })
    expect(r).toMatchObject({ ok: true, barberName: 'Diego' })
  })
  it('duas reservas simultâneas no mesmo horário: só uma entra', async () => {
    const [r1, r2] = await Promise.all([book(), book({ customerPhone: '11911111111' })])
    const oks = [r1, r2].filter((r) => r.ok)
    expect(oks).toHaveLength(1)
    expect([r1, r2].find((r) => !r.ok)).toEqual({ ok: false, error: 'SLOT_TAKEN' })
  })
  it('normaliza telefone e aplica limite de 3 só para online', async () => {
    const r = await book({ customerPhone: '+55 (11) 98765-4321' })
    expect(r.ok).toBe(true)
    expect(repo.appointments[0].customerPhone).toBe('11987654321')
    await book({ start: atTime(DAY, '11:00').toISOString() })
    await book({ start: atTime(DAY, '14:00').toISOString() })
    expect(await book({ start: atTime(DAY, '15:00').toISOString(), customerPhone: '(11) 98765-4321' }))
      .toEqual({ ok: false, error: 'TOO_MANY' })
    expect((await book({ start: atTime(DAY, '15:00').toISOString(), source: 'manual' })).ok).toBe(true)
  })
  it('horário fora da grade é recusado', async () => {
    expect(await book({ start: atTime(DAY, '10:07').toISOString() })).toEqual({ ok: false, error: 'SLOT_TAKEN' })
  })
  it('valida nome, telefone e serviço', async () => {
    expect(await book({ customerName: ' a ' })).toEqual({ ok: false, error: 'INVALID_NAME' })
    expect(await book({ customerPhone: '123' })).toEqual({ ok: false, error: 'INVALID_PHONE' })
    expect(await book({ serviceId: 'nao-existe' })).toEqual({ ok: false, error: 'NOT_FOUND' })
  })
  it('data fora da janela retorna OUT_OF_RANGE', async () => {
    expect(await book({ start: atTime('2027-02-02', '10:00').toISOString() })).toEqual({ ok: false, error: 'OUT_OF_RANGE' })
  })
  it('manual ignora antecedência mínima', async () => {
    const now = atTime(DAY, '09:50')
    expect(await book({ now, start: atTime(DAY, '10:00').toISOString() })).toEqual({ ok: false, error: 'SLOT_TAKEN' })
    expect((await book({ now, start: atTime(DAY, '10:00').toISOString(), source: 'manual' })).ok).toBe(true)
  })
})

describe('correções da revisão final', () => {
  it('falha do banco vira UNAVAILABLE em vez de exceção', async () => {
    repo.loadDay = async () => { throw new Error('timeout') }
    expect(await book()).toEqual({ ok: false, error: 'UNAVAILABLE' })
  })
  it('tryGetAvailableSlots retorna null quando o banco falha', async () => {
    repo.getSettings = async () => { throw new Error('timeout') }
    expect(await tryGetAvailableSlots(repo, { serviceId: 'corte', barberId: 'a', date: DAY, now: NOW })).toBeNull()
  })
  it('manual permite marcar o horário que começou há poucos minutos (cliente chegou na hora)', async () => {
    const now = atTime(DAY, '10:07')
    expect((await book({ now, start: atTime(DAY, '10:00').toISOString(), source: 'manual' })).ok).toBe(true)
    expect(await book({ now, start: atTime(DAY, '09:45').toISOString(), source: 'manual', customerPhone: '11922222222' }))
      .toEqual({ ok: false, error: 'SLOT_TAKEN' })
  })
  it('mesmo telefone não ocupa dois barbeiros no mesmo horário', async () => {
    expect((await book({ barberId: 'any' })).ok).toBe(true)
    expect(await book({ barberId: 'any' })).toEqual({ ok: false, error: 'ALREADY_BOOKED' })
  })
})
