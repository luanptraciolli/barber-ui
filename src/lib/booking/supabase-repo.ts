import type { SupabaseClient } from '@supabase/supabase-js'
import type { Interval, WorkingHour } from '../availability'
import { addDaysToDate, atTime } from '../time'
import type { BookingRepo, DayData, Settings } from './types'

/** Converte "[2026-12-07 13:00:00+00,2026-12-07 13:30:00+00)" em Interval. */
export function parseRange(r: string): Interval {
  const toDate = (s: string) =>
    new Date(s.trim().replace(/^"|"$/g, '').replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
  const [a, b] = r.slice(1, -1).split(',')
  return { start: toDate(a), end: toDate(b) }
}

const toRange = (s: Date, e: Date) => `[${s.toISOString()},${e.toISOString()})`

export function rowToSettings(r: Record<string, unknown>): Settings {
  return {
    shopName: String(r.shop_name ?? ''),
    whatsapp: String(r.whatsapp ?? ''),
    address: String(r.address ?? ''),
    logoUrl: (r.logo_url as string | null) ?? null,
    minAdvanceMin: Number(r.min_advance_min ?? 60),
    bookingWindowDays: Number(r.booking_window_days ?? 30),
  }
}

export function supabaseRepo(db: SupabaseClient): BookingRepo {
  const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(r.error.message)
    return r.data as T
  }
  return {
    async getSettings() {
      return rowToSettings(must(await db.from('settings').select('*').eq('id', 1).single()))
    },
    async getService(id) {
      const r = await db.from('services').select('*').eq('id', id).eq('active', true).maybeSingle()
      const s = must(r) as Record<string, unknown> | null
      return s
        ? { id: String(s.id), name: String(s.name), durationMin: Number(s.duration_min), priceCents: Number(s.price_cents) }
        : null
    },
    async listBarbers() {
      const rows = must(await db.from('barbers').select('id,name,photo_url').eq('active', true).order('sort_order'))
      return (rows as { id: string; name: string; photo_url: string | null }[]).map((b) => ({
        id: b.id, name: b.name, photoUrl: b.photo_url,
      }))
    },
    async loadDay(date, barberIds): Promise<DayData> {
      const out: DayData = { workingHours: {}, busy: {}, countsToday: {} }
      if (barberIds.length === 0) return out
      const day = toRange(atTime(date, '00:00'), atTime(addDaysToDate(date, 1), '00:00'))
      const [wh, appts, blocks] = await Promise.all([
        db.from('working_hours').select('barber_id,weekday,start_time,end_time').in('barber_id', barberIds),
        db.from('appointments').select('barber_id,period').in('barber_id', barberIds)
          .eq('status', 'confirmed').overlaps('period', day),
        db.from('time_blocks').select('barber_id,starts_at,ends_at')
          .lt('starts_at', atTime(addDaysToDate(date, 1), '00:00').toISOString())
          .gt('ends_at', atTime(date, '00:00').toISOString()),
      ])
      for (const id of barberIds) out.workingHours[id] = [], out.busy[id] = [], out.countsToday[id] = 0
      for (const w of must(wh) as { barber_id: string; weekday: number; start_time: string; end_time: string }[]) {
        const h: WorkingHour = { weekday: w.weekday, start: w.start_time.slice(0, 5), end: w.end_time.slice(0, 5) }
        out.workingHours[w.barber_id].push(h)
      }
      for (const a of must(appts) as { barber_id: string; period: string }[]) {
        out.busy[a.barber_id].push(parseRange(a.period))
        out.countsToday[a.barber_id]++
      }
      for (const b of must(blocks) as { barber_id: string | null; starts_at: string; ends_at: string }[]) {
        const i = { start: new Date(b.starts_at), end: new Date(b.ends_at) }
        for (const id of b.barber_id === null ? barberIds : [b.barber_id]) out.busy[id]?.push(i)
      }
      return out
    },
    async countFutureByPhone(phone, now) {
      const r = await db.from('appointments').select('id', { count: 'exact', head: true })
        .eq('customer_phone', phone).eq('status', 'confirmed')
        .overlaps('period', toRange(now, new Date('9999-01-01T00:00:00Z')))
      if (r.error) throw new Error(r.error.message)
      return r.count ?? 0
    },
    async insertAppointment(a) {
      const r = await db.from('appointments').insert({
        barber_id: a.barberId, service_id: a.serviceId, customer_name: a.customerName,
        customer_phone: a.customerPhone, period: toRange(a.start, a.end), source: a.source,
      }).select('id').single()
      if (r.error) {
        if (r.error.code === '23P01') return { ok: false, reason: 'conflict' }
        throw new Error(r.error.message)
      }
      return { ok: true, id: (r.data as { id: string }).id }
    },
  }
}
