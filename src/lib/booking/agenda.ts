import type { Barber } from './types'

export type AgendaItem = {
  id: string
  barberId: string
  serviceName: string
  customerName: string
  customerPhone: string
  start: string
  end: string
  status: 'confirmed' | 'cancelled'
  source: 'online' | 'manual'
}

export function groupByBarber(appts: AgendaItem[], barbers: Barber[]): Record<string, AgendaItem[]> {
  const out: Record<string, AgendaItem[]> = {}
  for (const b of barbers) out[b.id] = []
  for (const a of appts) (out[a.barberId] ??= []).push(a)
  for (const list of Object.values(out)) list.sort((x, y) => x.start.localeCompare(y.start))
  return out
}
