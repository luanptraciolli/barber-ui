import Link from 'next/link'
import { groupByBarber } from '@/lib/booking/agenda'
import { loadAgenda } from '@/lib/booking/agenda-loader'
import { requireStaff } from '@/lib/booking/staff'
import { buildDayStrip } from '@/lib/dates'
import { addDaysToDate, dateInTz, formatTime, todayInTz } from '@/lib/time'

export default async function SemanaPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams
  const today = todayInTz(new Date())
  const from = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today
  const { db } = await requireStaff()
  const { items, barbers, hours } = await loadAgenda(db, from, 7)
  const openWeekdays = [...new Set(hours.map((h) => h.weekday))]
  const days = buildDayStrip(from, 6, openWeekdays)
  return (
    <main className="mx-auto max-w-5xl px-5 pb-16">
      <div className="flex items-center gap-3 pt-4">
        <Link href={`/painel/semana?d=${addDaysToDate(from, -7)}`} aria-label="Semana anterior"
          className="grid size-10 place-items-center rounded-md border border-green-line text-xl hover:border-sage">‹</Link>
        <Link href={`/painel/semana?d=${addDaysToDate(from, 7)}`} aria-label="Próxima semana"
          className="grid size-10 place-items-center rounded-md border border-green-line text-xl hover:border-sage">›</Link>
        <h1 className="font-display text-3xl font-bold">Próximos 7 dias</h1>
      </div>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((day) => {
          const dayItems = items.filter((i) => dateInTz(new Date(i.start)) === day.date)
          const g = groupByBarber(dayItems, barbers)
          return (
            <li key={day.date}>
              <Link href={`/painel?d=${day.date}`}
                className={`block h-full rounded-md border border-green-line p-4 hover:border-sage ${day.open ? '' : 'opacity-50'}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold">{day.weekdayShort} {day.day}/{day.monthShort}</span>
                  <span className="text-sm text-sage">{day.open ? `${dayItems.length} horários` : 'Fechado'}</span>
                </div>
                {barbers.map((b) => (
                  <div key={b.id} className="mt-3">
                    <p className="text-sm text-brass">{b.name} · {g[b.id].length}</p>
                    <p className="text-sm text-sage tabular-nums">
                      {g[b.id].slice(0, 6).map((i) => formatTime(i.start)).join('  ')}{g[b.id].length > 6 ? '  …' : ''}
                    </p>
                  </div>
                ))}
              </Link>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
