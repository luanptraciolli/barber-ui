import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client com chave secreta (service role): ignora RLS. Usar SOMENTE no servidor.
 * A chave vai só no header `apikey` (suficiente para chaves `sb_secret_...`),
 * nunca em `Authorization`, para não vazar em logs de proxies intermediários.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers)
        if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization')
        return fetch(input, { ...init, headers })
      },
    },
  })
}
