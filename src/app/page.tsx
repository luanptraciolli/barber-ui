import Link from 'next/link'
import { getCatalog } from '@/lib/booking/catalog'
import { formatBRL } from '@/lib/money'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { settings, services } = await getCatalog()
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pb-16">
      <div className="pole -mx-5 h-3" aria-hidden />
      <header className="pt-12 pb-10">
        <h1 className="font-display text-6xl leading-[0.9] font-extrabold tracking-tight text-bone sm:text-7xl">
          {settings.shopName}
        </h1>
        <p className="mt-4 text-sage">{settings.address}</p>
      </header>

      <Link
        href="/agendar"
        className="block rounded-md bg-brass px-6 py-4 text-center text-lg font-semibold text-green-deep transition-colors hover:bg-[#d9b23a]"
      >
        Agendar horário
      </Link>

      <section className="mt-14" aria-labelledby="precos">
        <h2 id="precos" className="font-display text-3xl font-semibold text-brass">
          Serviços e preços
        </h2>
        <ul className="mt-5 space-y-4">
          {services.map((s) => (
            <li key={s.id} className="flex items-end">
              <span>
                <span className="text-lg">{s.name}</span>
                <span className="ml-2 text-sm text-sage">{s.durationMin} min</span>
              </span>
              <span className="leader" aria-hidden />
              <span className="font-display text-xl font-semibold tabular-nums">{formatBRL(s.priceCents)}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
