import { Suspense } from 'react'
import { getCatalog } from '@/lib/booking/catalog'
import { todayInTz } from '@/lib/time'
import { BookingWizard } from './BookingWizard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Agendar horário' }

export default async function AgendarPage() {
  const catalog = await getCatalog()
  return (
    <Suspense>
      <BookingWizard catalog={catalog} today={todayInTz(new Date())} />
    </Suspense>
  )
}
