import { atTime, weekdayOf } from './time'

export type Interval = { start: Date; end: Date }
export type WorkingHour = { weekday: number; start: string; end: string }

const MIN = 60_000

export function computeSlots(i: {
  date: string
  durationMin: number
  workingHours: WorkingHour[]
  busy: Interval[]
  now: Date
  minAdvanceMin: number
  stepMin?: number
}): Date[] {
  const step = (i.stepMin ?? 15) * MIN
  const dur = i.durationMin * MIN
  const earliest = i.now.getTime() + i.minAdvanceMin * MIN
  const weekday = weekdayOf(i.date)
  const out: Date[] = []
  for (const wh of i.workingHours.filter((w) => w.weekday === weekday)) {
    const from = atTime(i.date, wh.start).getTime()
    const to = atTime(i.date, wh.end).getTime()
    for (let s = from; s + dur <= to; s += step) {
      if (s < earliest) continue
      const e = s + dur
      const clash = i.busy.some((b) => s < b.end.getTime() && b.start.getTime() < e)
      if (!clash) out.push(new Date(s))
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime())
}

export function mergeAnySlots(perBarber: Record<string, Date[]>): Date[] {
  const set = new Set<number>()
  for (const list of Object.values(perBarber)) for (const d of list) set.add(d.getTime())
  return [...set].sort((a, b) => a - b).map((n) => new Date(n))
}

export function pickBarber(free: string[], countsToday: Record<string, number>): string {
  let best = free[0]
  for (const id of free) if ((countsToday[id] ?? 0) < (countsToday[best] ?? 0)) best = id
  return best
}
