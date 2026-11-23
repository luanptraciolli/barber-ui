import { TZDate } from '@date-fns/tz'
import { addDays, format } from 'date-fns'

export const TZ = 'America/Sao_Paulo'

/** Instante absoluto de `hhmm` no dia `date` (YYYY-MM-DD) no fuso de São Paulo. */
export function atTime(date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, TZ).getTime())
}

/** Dia da semana (0 = domingo) da data em SP. */
export function weekdayOf(date: string): number {
  return new TZDate(atTime(date, '12:00'), TZ).getDay()
}

/** Data (YYYY-MM-DD) do instante `d` no fuso de SP. */
export function dateInTz(d: Date): string {
  return format(new TZDate(d, TZ), 'yyyy-MM-dd')
}

/** Data de hoje (YYYY-MM-DD) em SP. */
export const todayInTz = (now: Date): string => dateInTz(now)

export function addDaysToDate(date: string, days: number): string {
  return format(addDays(new TZDate(atTime(date, '12:00'), TZ), days), 'yyyy-MM-dd')
}

export function formatTime(d: Date | string): string {
  return format(new TZDate(new Date(d), TZ), 'HH:mm')
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutos desde a meia-noite (em SP) do instante dado. */
export function minutesInTz(d: Date | string): number {
  return toMinutes(formatTime(d))
}
