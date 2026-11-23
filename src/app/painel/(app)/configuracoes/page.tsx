import { requireStaff } from '@/lib/booking/staff'
import { rowToSettings } from '@/lib/booking/supabase-repo'
import { ConfigForms } from './ConfigForms'

export default async function ConfiguracoesPage() {
  const { db } = await requireStaff()
  const [st, sv, br, wh] = await Promise.all([
    db.from('settings').select('*').eq('id', 1).single(),
    db.from('services').select('id,name,duration_min,price_cents,active').order('sort_order'),
    db.from('barbers').select('id,name').eq('active', true).order('sort_order'),
    db.from('working_hours').select('barber_id,weekday,start_time,end_time').order('start_time'),
  ])
  for (const r of [st, sv, br, wh]) if (r.error) throw new Error(r.error.message)
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20">
      <h1 className="pt-4 font-display text-4xl font-extrabold">Configurações</h1>
      <ConfigForms
        settings={rowToSettings(st.data)}
        services={(sv.data as { id: string; name: string; duration_min: number; price_cents: number; active: boolean }[])}
        barbers={br.data as { id: string; name: string }[]}
        hours={(wh.data as { barber_id: string; weekday: number; start_time: string; end_time: string }[]).map((h) => ({
          barberId: h.barber_id, weekday: h.weekday, start: h.start_time.slice(0, 5), end: h.end_time.slice(0, 5),
        }))}
      />
    </main>
  )
}
