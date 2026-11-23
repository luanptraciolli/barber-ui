import 'server-only'
import { createAdminClient } from '../supabase/admin'
import { rowToSettings } from './supabase-repo'
import type { Barber, Service, Settings } from './types'

export type Catalog = {
  settings: Settings
  services: Service[]
  barbers: Barber[]
  /** dias da semana com expediente, por barbeiro */
  openWeekdays: Record<string, number[]>
}

export async function getCatalog(): Promise<Catalog> {
  const db = createAdminClient()
  const [s, sv, b, wh] = await Promise.all([
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('services').select('id,name,duration_min,price_cents').eq('active', true).order('sort_order'),
    db.from('barbers').select('id,name,photo_url').eq('active', true).order('sort_order'),
    db.from('working_hours').select('barber_id,weekday'),
  ])
  for (const r of [s, sv, b, wh]) if (r.error) throw new Error(r.error.message)
  const openWeekdays: Record<string, number[]> = {}
  for (const row of wh.data as { barber_id: string; weekday: number }[]) {
    const list = (openWeekdays[row.barber_id] ??= [])
    if (!list.includes(row.weekday)) list.push(row.weekday)
  }
  return {
    settings: rowToSettings(s.data),
    services: (sv.data as { id: string; name: string; duration_min: number; price_cents: number }[]).map((x) => ({
      id: x.id, name: x.name, durationMin: x.duration_min, priceCents: x.price_cents,
    })),
    barbers: (b.data as { id: string; name: string; photo_url: string | null }[]).map((x) => ({
      id: x.id, name: x.name, photoUrl: x.photo_url,
    })),
    openWeekdays,
  }
}
