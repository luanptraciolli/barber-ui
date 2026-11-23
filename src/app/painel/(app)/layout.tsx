import Link from 'next/link'
import { requireStaff } from '@/lib/booking/staff'
import { signOut } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Painel' }

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  await requireStaff()
  return (
    <div className="min-h-dvh">
      <div className="pole h-1.5" aria-hidden />
      <header className="mx-auto flex max-w-5xl items-center gap-5 px-5 py-3 text-sm">
        <Link href="/painel" className="font-display text-2xl font-extrabold">Agenda</Link>
        <nav className="flex flex-1 gap-4 text-sage">
          <Link href="/painel/semana" className="hover:text-bone">Semana</Link>
          <Link href="/painel/configuracoes" className="hover:text-bone">Configurações</Link>
        </nav>
        <form action={signOut}>
          <button className="text-sage hover:text-bone">Sair</button>
        </form>
      </header>
      {children}
    </div>
  )
}
