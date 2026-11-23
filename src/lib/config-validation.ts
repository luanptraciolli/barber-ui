import type { WorkingHour } from './availability'
import { dateInTz, minutesInTz, toMinutes, weekdayOf } from './time'

export function parsePriceToCents(raw: string): number | null {
  const clean = raw.replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null
  return Math.round(Number(clean) * 100)
}

export function validateDuration(min: number): boolean {
  return Number.isInteger(min) && min >= 5 && min <= 240 && min % 5 === 0
}

export function validateHours(hours: WorkingHour[]): string | null {
  for (const h of hours) {
    if (!/^\d{2}:\d{2}$/.test(h.start) || !/^\d{2}:\d{2}$/.test(h.end)) return 'Informe os horários no formato HH:mm.'
    if (toMinutes(h.end) <= toMinutes(h.start)) return 'O fim precisa ser depois do início.'
  }
  for (let d = 0; d <= 6; d++) {
    const day = hours.filter((h) => h.weekday === d).sort((a, b) => a.start.localeCompare(b.start))
    for (let i = 1; i < day.length; i++) {
      if (toMinutes(day[i].start) < toMinutes(day[i - 1].end)) return 'Os intervalos de um mesmo dia não podem se sobrepor.'
    }
  }
  return null
}

/** Quantos agendamentos não cabem inteiros em algum intervalo do expediente do seu dia. */
export function countOutsideHours(appts: { start: Date; end: Date }[], hours: WorkingHour[]): number {
  return appts.filter((a) => {
    const wd = weekdayOf(dateInTz(a.start))
    const s = minutesInTz(a.start)
    const e = minutesInTz(a.end) || 24 * 60
    return !hours.some((h) => h.weekday === wd && toMinutes(h.start) <= s && e <= toMinutes(h.end))
  }).length
}
