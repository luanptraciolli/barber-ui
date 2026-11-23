'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createBooking, getAvailableSlots } from '@/lib/booking/service'
import { requireStaff } from '@/lib/booking/staff'
import { supabaseRepo } from '@/lib/booking/supabase-repo'
import type { BookingResult, SlotOption } from '@/lib/booking/types'
import { atTime } from '@/lib/time'

const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

export async function cancelAppointment(id: string): Promise<{ ok: boolean }> {
  const { db } = await requireStaff()
  const r = await db.from('appointments').update({ status: 'cancelled' }).eq('id', s(id))
  revalidatePath('/painel', 'layout')
  return { ok: !r.error }
}

export async function panelSlots(serviceId: string, barberId: string, date: string): Promise<SlotOption[]> {
  const { db } = await requireStaff()
  return getAvailableSlots(supabaseRepo(db), {
    serviceId: s(serviceId), barberId: s(barberId), date: s(date, 10), now: new Date(), ignoreAdvance: true,
  })
}

export async function createManualBooking(input: {
  serviceId: string; barberId: string; start: string; customerName: string; customerPhone: string
}): Promise<BookingResult> {
  const { db } = await requireStaff()
  const r = await createBooking(supabaseRepo(db), {
    serviceId: s(input.serviceId), barberId: s(input.barberId), start: s(input.start, 40),
    customerName: s(input.customerName, 80), customerPhone: s(input.customerPhone, 30),
    now: new Date(), source: 'manual',
  })
  if (r.ok) revalidatePath('/painel', 'layout')
  return r
}

export async function createBlock(input: {
  barberId: string | null; date: string; startTime: string; endTime: string; reason: string
}): Promise<{ ok: boolean; error?: string }> {
  const { db } = await requireStaff()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s(input.date)) || !/^\d{2}:\d{2}$/.test(s(input.startTime)) || !/^\d{2}:\d{2}$/.test(s(input.endTime))) {
    return { ok: false, error: 'Preencha dia e horários.' }
  }
  const start = atTime(input.date, input.startTime)
  const end = atTime(input.date, input.endTime)
  if (end <= start) return { ok: false, error: 'O fim precisa ser depois do início.' }
  const r = await db.from('time_blocks').insert({
    barber_id: input.barberId || null, starts_at: start.toISOString(), ends_at: end.toISOString(), reason: s(input.reason, 120),
  })
  if (r.error) return { ok: false, error: 'Não foi possível bloquear. Tente de novo.' }
  revalidatePath('/painel', 'layout')
  return { ok: true }
}

export async function deleteBlock(id: string): Promise<{ ok: boolean }> {
  const { db } = await requireStaff()
  const r = await db.from('time_blocks').delete().eq('id', s(id))
  revalidatePath('/painel', 'layout')
  return { ok: !r.error }
}

export async function signOut() {
  const { db } = await requireStaff()
  await db.auth.signOut()
  redirect('/painel/login')
}
