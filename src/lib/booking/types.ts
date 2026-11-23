import type { Interval, WorkingHour } from '../availability'

export type Service = { id: string; name: string; durationMin: number; priceCents: number }
export type Barber = { id: string; name: string; photoUrl: string | null }
export type Settings = {
  shopName: string
  whatsapp: string
  address: string
  logoUrl: string | null
  minAdvanceMin: number
  bookingWindowDays: number
}

export type DayData = {
  /** expediente por barberId */
  workingHours: Record<string, WorkingHour[]>
  /** agendamentos confirmados + bloqueios (bloqueios gerais já replicados para todos) */
  busy: Record<string, Interval[]>
  /** agendamentos confirmados no dia por barbeiro */
  countsToday: Record<string, number>
}

export type NewAppointment = {
  barberId: string
  serviceId: string
  customerName: string
  customerPhone: string
  start: Date
  end: Date
  source: 'online' | 'manual'
}

export interface BookingRepo {
  getSettings(): Promise<Settings>
  getService(id: string): Promise<Service | null>
  listBarbers(): Promise<Barber[]>
  loadDay(date: string, barberIds: string[]): Promise<DayData>
  countFutureByPhone(phone: string, now: Date): Promise<number>
  /** Há agendamento confirmado deste telefone que se sobrepõe a [start, end)? */
  hasPhoneOverlap(phone: string, start: Date, end: Date): Promise<boolean>
  insertAppointment(a: NewAppointment): Promise<{ ok: true; id: string } | { ok: false; reason: 'conflict' }>
}

export type SlotOption = { start: string; label: string }

export type BookingError =
  | 'SLOT_TAKEN' | 'INVALID_PHONE' | 'INVALID_NAME' | 'TOO_MANY' | 'OUT_OF_RANGE' | 'NOT_FOUND'
  | 'ALREADY_BOOKED' | 'UNAVAILABLE'
export type BookingResult =
  | { ok: true; appointmentId: string; barberName: string; start: string }
  | { ok: false; error: BookingError }
