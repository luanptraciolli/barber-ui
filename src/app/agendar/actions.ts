'use server'

import { createBooking, getAvailableSlots } from '@/lib/booking/service'
import { supabaseRepo } from '@/lib/booking/supabase-repo'
import type { BookingResult, SlotOption } from '@/lib/booking/types'
import { createAdminClient } from '@/lib/supabase/admin'

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)

export async function fetchSlots(serviceId: string, barberId: string, date: string): Promise<SlotOption[]> {
  if (!isDate(str(date))) return []
  return getAvailableSlots(supabaseRepo(createAdminClient()), {
    serviceId: str(serviceId), barberId: str(barberId), date, now: new Date(),
  })
}

export async function submitBooking(input: {
  serviceId: string
  barberId: string
  start: string
  customerName: string
  customerPhone: string
}): Promise<BookingResult> {
  return createBooking(supabaseRepo(createAdminClient()), {
    serviceId: str(input.serviceId),
    barberId: str(input.barberId),
    start: str(input.start, 40),
    customerName: str(input.customerName, 80),
    customerPhone: str(input.customerPhone, 30),
    now: new Date(),
    source: 'online',
  })
}
