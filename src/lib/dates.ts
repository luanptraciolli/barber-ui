import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { addDaysToDate, atTime, TZ, weekdayOf } from './time'

const inTz = (date: string) => new TZDate(atTime(date, '12:00'), TZ)

/** "sábado, 12 de dezembro" */
export function formatLongDate(date: string): string {
  return format(inTz(date), "EEEE, d 'de' MMMM", { locale: ptBR })
}

export type DayChip = { date: string; weekdayShort: string; day: string; monthShort: string; open: boolean }

/** Dias de `from` até `from + windowDays` (inclusive), marcando os dias sem expediente. */
export function buildDayStrip(from: string, windowDays: number, openWeekdays: number[]): DayChip[] {
  const out: DayChip[] = []
  for (let i = 0; i <= windowDays; i++) {
    const date = addDaysToDate(from, i)
    const d = inTz(date)
    out.push({
      date,
      weekdayShort: format(d, 'EEEE', { locale: ptBR }).slice(0, 3),
      day: format(d, 'd'),
      monthShort: format(d, 'MMM', { locale: ptBR }),
      open: openWeekdays.includes(weekdayOf(date)),
    })
  }
  return out
}
