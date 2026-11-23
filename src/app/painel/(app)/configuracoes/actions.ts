'use server'

import { revalidatePath } from 'next/cache'
import type { WorkingHour } from '@/lib/availability'
import { parseRange } from '@/lib/booking/supabase-repo'
import { requireStaff } from '@/lib/booking/staff'
import { countOutsideHours, parsePriceToCents, validateDuration, validateHours } from '@/lib/config-validation'
import { normalizePhone } from '@/lib/phone'

export type SaveResult = { ok: boolean; error?: string; warning?: string }
const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function saveSettings(input: { shopName: string; whatsapp: string; address: string }): Promise<SaveResult> {
  const { db } = await requireStaff()
  const name = s(input.shopName, 80)
  if (name.length < 2) return { ok: false, error: 'Informe o nome da barbearia.' }
  const whatsapp = normalizePhone(s(input.whatsapp, 30))
  if (!whatsapp) return { ok: false, error: 'Informe o WhatsApp com DDD.' }
  const r = await db.from('settings').update({ shop_name: name, whatsapp, address: s(input.address, 160) }).eq('id', 1)
  if (r.error) return { ok: false, error: 'Não foi possível salvar. Tente de novo.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveService(input: {
  id?: string; name: string; durationMin: number; price: string; active: boolean
}): Promise<SaveResult> {
  const { db } = await requireStaff()
  const name = s(input.name, 60)
  if (name.length < 2) return { ok: false, error: 'Informe o nome do serviço.' }
  const duration = Number(input.durationMin)
  if (!validateDuration(duration)) return { ok: false, error: 'A duração deve ser de 5 a 240 minutos, de 5 em 5.' }
  const price = parsePriceToCents(s(input.price, 20))
  if (price === null) return { ok: false, error: 'Informe o preço, por exemplo 45,00.' }
  const row = { name, duration_min: duration, price_cents: price, active: Boolean(input.active) }
  const r = input.id
    ? await db.from('services').update(row).eq('id', s(input.id, 40))
    : await db.from('services').insert({ ...row, sort_order: 100 })
  if (r.error) return { ok: false, error: 'Não foi possível salvar. Tente de novo.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function saveWorkingHours(barberId: string, hours: WorkingHour[]): Promise<SaveResult> {
  const { db } = await requireStaff()
  const clean = (Array.isArray(hours) ? hours : []).map((h) => ({
    weekday: Number(h.weekday), start: s(h.start, 5), end: s(h.end, 5),
  })).filter((h) => Number.isInteger(h.weekday) && h.weekday >= 0 && h.weekday <= 6)
  const invalid = validateHours(clean)
  if (invalid) return { ok: false, error: invalid }
  const r = await db.rpc('replace_working_hours', { p_barber_id: s(barberId, 40), p_hours: clean })
  if (r.error) return { ok: false, error: 'Não foi possível salvar. Tente de novo.' }
  const future = await db.from('appointments').select('period').eq('barber_id', s(barberId, 40))
    .eq('status', 'confirmed').overlaps('period', `[${new Date().toISOString()},9999-01-01T00:00:00Z)`)
  const n = future.error ? 0 : countOutsideHours((future.data as { period: string }[]).map((x) => parseRange(x.period)), clean)
  revalidatePath('/', 'layout')
  return {
    ok: true,
    warning: n > 0 ? `Existem ${n} agendamento${n > 1 ? 's' : ''} fora do novo horário. Eles continuam na agenda.` : undefined,
  }
}
