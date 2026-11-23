import 'server-only'
import { createServerClient as createSsrClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Client do usuário logado (painel), sujeito à RLS. */
export async function createServerClient() {
  const store = await cookies()
  return createSsrClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options))
        } catch {
          // chamado de um Server Component: o middleware renova a sessão
        }
      },
    },
  })
}
