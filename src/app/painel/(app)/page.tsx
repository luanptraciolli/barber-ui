import Link from 'next/link'
import { loadAgenda } from '@/lib/booking/agenda-loader'
import { requireStaff } from '@/lib/booking/staff'
import { formatLongDate } from '@/lib/dates'
import { addDaysToDate, todayInTz } from '@/lib/time'
import { DayBoard } from './DayBoard'

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams
  const today = todayInTz(new Date())
  const date = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today
  const { db } = await requireStaff()
  const data = await loadAgenda(db, date)
  const count = data.items.length
  return (
    <main className="mx-auto max-w-5xl px-5 pb-16">
      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Link href={`/painel?d=${addDaysToDate(date, -1)}`} aria-label="Dia anterior"
          className="grid size-10 place-items-center rounded-md border border-green-line text-xl hover:border-sage">‹</Link>
        <Link href={`/painel?d=${addDaysToDate(date, 1)}`} aria-label="Próximo dia"
          className="grid size-10 place-items-center rounded-md border border-green-line text-xl hover:border-sage">›</Link>
        {date !== today && (
          <Link href="/painel" className="rounded-md border border-green-line px-3 py-2 text-sm hover:border-sage">Hoje</Link>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-3xl leading-none font-bold first-letter:uppercase">{formatLongDate(date)}</h1>
          <p className="text-sm text-sage">{count === 0 ? 'Nenhum horário marcado' : count === 1 ? '1 horário marcado' : `${count} horários marcados`}</p>
        </div>
      </div>
      <DayBoard date={date} {...data} />
    </main>
  )
}
