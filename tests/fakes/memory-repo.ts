import type { Interval, WorkingHour } from '@/lib/availability'
import type { Barber, BookingRepo, DayData, NewAppointment, Service, Settings } from '@/lib/booking/types'
import { addDaysToDate, atTime } from '@/lib/time'

type Appt = NewAppointment & { id: string; status: 'confirmed' | 'cancelled' }
type Block = { barberId: string | null; start: Date; end: Date }

export class MemoryRepo implements BookingRepo {
  settings: Settings = {
    shopName: 'Teste', whatsapp: '11900000000', address: '', logoUrl: null, minAdvanceMin: 60, bookingWindowDays: 30,
  }
  barbers: Barber[] = []
  services: Service[] = []
  hours: Record<string, WorkingHour[]> = {}
  blocks: Block[] = []
  appointments: Appt[] = []
  private seq = 0

  async getSettings() { return this.settings }
  async getService(id: string) { return this.services.find((s) => s.id === id) ?? null }
  async listBarbers() { return this.barbers }

  async loadDay(date: string, barberIds: string[]): Promise<DayData> {
    const from = atTime(date, '00:00').getTime()
    const to = atTime(addDaysToDate(date, 1), '00:00').getTime()
    const overlaps = (i: Interval) => i.start.getTime() < to && from < i.end.getTime()
    const out: DayData = { workingHours: {}, busy: {}, countsToday: {} }
    for (const id of barberIds) {
      const appts = this.appointments.filter((a) => a.barberId === id && a.status === 'confirmed' && overlaps(a))
      const blocks = this.blocks.filter((b) => (b.barberId === null || b.barberId === id) && overlaps(b))
      out.workingHours[id] = this.hours[id] ?? []
      out.busy[id] = [...appts, ...blocks].map((x) => ({ start: x.start, end: x.end }))
      out.countsToday[id] = appts.length
    }
    return out
  }

  async countFutureByPhone(phone: string, now: Date) {
    return this.appointments.filter(
      (a) => a.customerPhone === phone && a.status === 'confirmed' && a.start.getTime() > now.getTime(),
    ).length
  }

  async insertAppointment(a: NewAppointment) {
    const clash = this.appointments.some(
      (x) => x.barberId === a.barberId && x.status === 'confirmed' && x.start < a.end && a.start < x.end,
    )
    if (clash) return { ok: false as const, reason: 'conflict' as const }
    const id = `appt-${++this.seq}`
    this.appointments.push({ ...a, id, status: 'confirmed' })
    return { ok: true as const, id }
  }
}
