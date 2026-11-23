// Verificação rápida contra o Supabase real: npx tsx --env-file=.env.local scripts/smoke-repo.ts
import { createClient } from '@supabase/supabase-js'
import { supabaseRepo } from '../src/lib/booking/supabase-repo'
import { createBooking, getAvailableSlots } from '../src/lib/booking/service'
import { addDaysToDate, todayInTz } from '../src/lib/time'

async function main() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers)
        if (h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization')
        return fetch(input, { ...init, headers: h })
      },
    },
  })
  const repo = supabaseRepo(db)
  const barbers = await repo.listBarbers()
  console.log('barbeiros:', barbers.map((b) => b.name).join(', '))
  const now = new Date()
  let date = addDaysToDate(todayInTz(now), 1)
  let slots: Awaited<ReturnType<typeof getAvailableSlots>> = []
  for (let i = 0; i < 7 && slots.length === 0; i++, date = addDaysToDate(date, 1)) {
    slots = await getAvailableSlots(repo, { serviceId: '00000000-0000-0000-0000-00000000c001', barberId: 'any', date, now })
  }
  console.log('horários livres:', slots.length, 'primeiro:', slots[0]?.label)
  const r = await createBooking(repo, {
    serviceId: '00000000-0000-0000-0000-00000000c001', barberId: 'any', start: slots[0].start,
    customerName: 'Teste Smoke', customerPhone: '11999990000', now, source: 'online',
  })
  console.log('reserva:', JSON.stringify(r))
  if (!r.ok) process.exit(1)
  const dup = await createBooking(repo, {
    serviceId: '00000000-0000-0000-0000-00000000c001', barberId: barbers.find((b) => b.name === r.barberName)!.id,
    start: slots[0].start, customerName: 'Outro', customerPhone: '11999990001', now, source: 'online',
  })
  console.log('duplicada:', JSON.stringify(dup))
  const del = await db.from('appointments').delete().eq('id', r.appointmentId)
  console.log(del.error ? 'erro ao limpar: ' + del.error.message : 'ok')
}
main().catch((e) => { console.error(e); process.exit(1) })
