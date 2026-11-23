import { afterEach, expect, it, vi } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'

afterEach(() => vi.unstubAllGlobals())

it('envia a chave secreta em apikey E em Authorization (senão o Supabase trata como anônimo)', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_teste'
  const seen: Headers[] = []
  vi.stubGlobal('fetch', async (_: unknown, init?: RequestInit) => {
    seen.push(new Headers(init?.headers))
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  })
  await createAdminClient().from('working_hours').select('*')
  expect(seen[0].get('apikey')).toBe('sb_secret_teste')
  expect(seen[0].get('Authorization')).toBe('Bearer sb_secret_teste')
})
