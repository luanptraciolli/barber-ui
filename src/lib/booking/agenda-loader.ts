import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDaysToDate, atTime } from '../time'
import type { AgendaItem } from './agenda'
import { parseRange } from './supabase-repo'
import type { Barber, Service } from './types'

export type BlockItem = { id: string; barberId: string | null; start: string; end: string; reason: string }
export type HoursRow = { barberId: string; weekday: number; start: string; end: string }

type ApptRow = {
  id: string; barber_id: string; customer_name: string; customer_phone: string; period: string
  status: 'confirmed' | 'cancelled'; source: 'online' | 'manual'; services: { name: string } | null
}

/** Carrega agenda (confirmados) e bloqueios de `from` (inclusive) por `days` dias, com o client do usuário (RLS). */
export async function loadAgenda(db: SupabaseClient, from: string, days = 1) {
  const startIso = atTime(from, '00:00').toISOString()
  const endIso = atTime(addDaysToDate(from, days), '00:00').toISOString()
  const [ap, bl, br, sv, wh] = await Promise.all([
    db.from('appointments')
      .select('id,barber_id,customer_name,customer_phone,period,status,source,services(name)')
      .eq('status', 'confirmed').overlaps('period', `[${startIso},${endIso})`),
    db.from('time_blocks').select('id,barber_id,starts_at,ends_at,reason').lt('starts_at', endIso).gt('ends_at', startIso),
    db.from('barbers').select('id,name,photo_url').eq('active', true).order('sort_order'),
    db.from('services').select('id,name,duration_min,price_cents').eq('active', true).order('sort_order'),
    db.from('working_hours').select('barber_id,weekday,start_time,end_time'),
  ])
  for (const r of [ap, bl, br, sv, wh]) if (r.error) throw new Error(r.error.message)
  const items: AgendaItem[] = (ap.data as unknown as ApptRow[]).map((a) => {
    const p = parseRange(a.period)
    return {
      id: a.id, barberId: a.barber_id, serviceName: a.services?.name ?? '', customerName: a.customer_name,
      customerPhone: a.customer_phone, start: p.start.toISOString(), end: p.end.toISOString(),
      status: a.status, source: a.source,
    }
  })
  const blocks: BlockItem[] = (bl.data as { id: string; barber_id: string | null; starts_at: string; ends_at: string; reason: string }[])
    .map((b) => ({ id: b.id, barberId: b.barber_id, start: new Date(b.starts_at).toISOString(), end: new Date(b.ends_at).toISOString(), reason: b.reason }))
  const barbers: Barber[] = (br.data as { id: string; name: string; photo_url: string | null }[])
    .map((b) => ({ id: b.id, name: b.name, photoUrl: b.photo_url }))
  const services: Service[] = (sv.data as { id: string; name: string; duration_min: number; price_cents: number }[])
    .map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min, priceCents: s.price_cents }))
  const hours: HoursRow[] = (wh.data as { barber_id: string; weekday: number; start_time: string; end_time: string }[])
    .map((h) => ({ barberId: h.barber_id, weekday: h.weekday, start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5) }))
  return { items, blocks, barbers, services, hours }
}
