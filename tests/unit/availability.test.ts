import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { computeSlots, mergeAnySlots, pickBarber, type WorkingHour } from '@/lib/availability'
import { atTime, todayInTz, weekdayOf } from '@/lib/time'

const TZ = 'America/Sao_Paulo'
const fmtOne = (d: Date) => format(new TZDate(d, TZ), 'HH:mm')
const fmt = (ds: Date[]) => ds.map(fmtOne)
const DAY = '2026-12-07' // segunda
const t = (hhmm: string) => atTime(DAY, hhmm)
const hours: WorkingHour[] = [
  { weekday: 1, start: '09:00', end: '12:00' },
  { weekday: 1, start: '13:00', end: '19:00' },
]
const EARLY = new Date('2026-12-01T00:00:00Z')
const base = { date: DAY, workingHours: hours, busy: [], now: EARLY, minAdvanceMin: 60 }

describe('time helpers', () => {
  it('atTime converte horário de SP para instante absoluto', () => {
    expect(atTime(DAY, '09:00').toISOString()).toBe('2026-12-07T12:00:00.000Z')
  })
  it('weekdayOf e todayInTz usam o fuso de SP', () => {
    expect(weekdayOf(DAY)).toBe(1)
    // 01:30Z do dia 8 ainda é dia 7 em SP
    expect(todayInTz(new Date('2026-12-08T01:30:00Z'))).toBe('2026-12-07')
  })
})

describe('computeSlots', () => {
  it('primeiro horário 09:00 SP = 12:00Z mesmo com servidor em UTC', () => {
    const slots = computeSlots({ ...base, durationMin: 30 })
    expect(slots[0].toISOString()).toBe('2026-12-07T12:00:00.000Z')
  })
  it('30 min sem ocupação gera 34 horários', () => {
    expect(computeSlots({ ...base, durationMin: 30 })).toHaveLength(34)
  })
  it('serviço de 50 min não ultrapassa almoço nem fim do expediente', () => {
    const s = fmt(computeSlots({ ...base, durationMin: 50 }))
    expect(s).toContain('11:00')
    expect(s).not.toContain('11:15')
    expect(s.at(-1)).toBe('18:00')
  })
  it('ocupação remove horários sobrepostos', () => {
    const s = fmt(computeSlots({ ...base, durationMin: 30, busy: [{ start: t('10:00'), end: t('10:30') }] }))
    expect(s).not.toContain('09:45')
    expect(s).not.toContain('10:00')
    expect(s).toContain('09:30')
    expect(s).toContain('10:30')
  })
  it('ocupação adjacente não remove o horário seguinte', () => {
    const s = fmt(computeSlots({ ...base, durationMin: 30, busy: [{ start: t('09:00'), end: t('09:30') }] }))
    expect(s[0]).toBe('09:30')
  })
  it('respeita antecedência mínima', () => {
    const s = fmt(computeSlots({ ...base, durationMin: 30, now: t('09:20') }))
    expect(s[0]).toBe('10:30')
  })
  it('dia sem expediente retorna vazio', () => {
    expect(computeSlots({ ...base, date: '2026-12-06', durationMin: 30 })).toEqual([])
  })
})

describe('mergeAnySlots', () => {
  it('união ordenada sem repetição', () => {
    expect(fmt(mergeAnySlots({ a: [t('09:00'), t('09:30')], b: [t('10:00'), t('09:00')] }))).toEqual([
      '09:00', '09:30', '10:00',
    ])
  })
})

describe('pickBarber', () => {
  it('escolhe quem tem menos agendamentos; empate fica com o primeiro', () => {
    expect(pickBarber(['a', 'b'], { a: 3, b: 1 })).toBe('b')
    expect(pickBarber(['a', 'b'], { a: 2, b: 2 })).toBe('a')
    expect(pickBarber(['a', 'b'], {})).toBe('a')
  })
})
