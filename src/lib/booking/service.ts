import { computeSlots, mergeAnySlots, pickBarber } from '../availability'
import { normalizePhone } from '../phone'
import { addDaysToDate, dateInTz, formatTime, todayInTz } from '../time'
import type { BookingError, BookingRepo, BookingResult, DayData, Service, SlotOption } from './types'

export { BOOKING_ERRORS } from './errors'

const MAX_FUTURE_PER_PHONE = 3
const STEP_MIN = 15
/** Painel: permite marcar o horário que começou há menos de um intervalo (cliente chegou na hora). */
const MANUAL_MIN_ADVANCE = -STEP_MIN + 1

function inWindow(date: string, now: Date, windowDays: number): boolean {
  const today = todayInTz(now)
  return date >= today && date <= addDaysToDate(today, windowDays)
}

function slotsPerBarber(
  service: Service,
  date: string,
  barberIds: string[],
  day: DayData,
  now: Date,
  minAdvanceMin: number,
): Record<string, Date[]> {
  const out: Record<string, Date[]> = {}
  for (const id of barberIds) {
    out[id] = computeSlots({
      date,
      durationMin: service.durationMin,
      workingHours: day.workingHours[id] ?? [],
      busy: day.busy[id] ?? [],
      now,
      minAdvanceMin,
    })
  }
  return out
}

async function loadContext(repo: BookingRepo, serviceId: string, barberId: string | 'any') {
  const [settings, service, barbers] = await Promise.all([
    repo.getSettings(),
    repo.getService(serviceId),
    repo.listBarbers(),
  ])
  const ids = barberId === 'any' ? barbers.map((b) => b.id) : barbers.filter((b) => b.id === barberId).map((b) => b.id)
  return { settings, service, barbers, ids }
}

export async function getAvailableSlots(
  repo: BookingRepo,
  a: { serviceId: string; barberId: string | 'any'; date: string; now: Date; ignoreAdvance?: boolean },
): Promise<SlotOption[]> {
  const { settings, service, ids } = await loadContext(repo, a.serviceId, a.barberId)
  if (!service || ids.length === 0 || !inWindow(a.date, a.now, settings.bookingWindowDays)) return []
  const day = await repo.loadDay(a.date, ids)
  const per = slotsPerBarber(service, a.date, ids, day, a.now, a.ignoreAdvance ? MANUAL_MIN_ADVANCE : settings.minAdvanceMin)
  return mergeAnySlots(per).map((d) => ({ start: d.toISOString(), label: formatTime(d) }))
}

type BookingInput = {
    serviceId: string
    barberId: string | 'any'
    start: string
    customerName: string
    customerPhone: string
    now: Date
    source: 'online' | 'manual'
}

/** Cria o agendamento. Nunca lança: falha de infraestrutura vira `UNAVAILABLE`. */
export async function createBooking(repo: BookingRepo, a: BookingInput): Promise<BookingResult> {
  try {
    return await bookOrThrow(repo, a)
  } catch (e) {
    console.error('createBooking falhou', e)
    return { ok: false, error: 'UNAVAILABLE' }
  }
}

/** Como getAvailableSlots, mas retorna null se o banco falhar (para a tela mostrar "tente de novo"). */
export async function tryGetAvailableSlots(
  repo: BookingRepo,
  a: Parameters<typeof getAvailableSlots>[1],
): Promise<SlotOption[] | null> {
  try {
    return await getAvailableSlots(repo, a)
  } catch (e) {
    console.error('getAvailableSlots falhou', e)
    return null
  }
}

async function bookOrThrow(repo: BookingRepo, a: BookingInput): Promise<BookingResult> {
  const fail = (error: BookingError): BookingResult => ({ ok: false, error })
  const name = a.customerName.trim()
  if (name.length < 2) return fail('INVALID_NAME')
  const phone = normalizePhone(a.customerPhone)
  if (!phone) return fail('INVALID_PHONE')

  const start = new Date(a.start)
  if (Number.isNaN(start.getTime())) return fail('SLOT_TAKEN')
  const date = dateInTz(start)

  const { settings, service, barbers, ids } = await loadContext(repo, a.serviceId, a.barberId)
  if (!service) return fail('NOT_FOUND')
  if (!inWindow(date, a.now, settings.bookingWindowDays)) return fail('OUT_OF_RANGE')
  if (a.source === 'online' && (await repo.countFutureByPhone(phone, a.now)) >= MAX_FUTURE_PER_PHONE) {
    return fail('TOO_MANY')
  }

  const day = await repo.loadDay(date, ids)
  const minAdvance = a.source === 'manual' ? MANUAL_MIN_ADVANCE : settings.minAdvanceMin
  const per = slotsPerBarber(service, date, ids, day, a.now, minAdvance)
  const candidates = ids.filter((id) => per[id].some((d) => d.getTime() === start.getTime()))

  // ordena candidatos pela regra de atribuição: quem tem menos agendamentos no dia primeiro
  const ordered: string[] = []
  const pool = [...candidates]
  while (pool.length) {
    const next = pickBarber(pool, day.countsToday)
    ordered.push(next)
    pool.splice(pool.indexOf(next), 1)
  }

  const end = new Date(start.getTime() + service.durationMin * 60_000)
  if (await repo.hasPhoneOverlap(phone, start, end)) return fail('ALREADY_BOOKED')
  for (const barberId of ordered) {
    const r = await repo.insertAppointment({
      barberId, serviceId: service.id, customerName: name, customerPhone: phone, start, end, source: a.source,
    })
    if (r.ok) {
      const barberName = barbers.find((b) => b.id === barberId)?.name ?? ''
      return { ok: true, appointmentId: r.id, barberName, start: start.toISOString() }
    }
  }
  return fail('SLOT_TAKEN')
}
