import { expect, it } from 'vitest'
import { parseRange } from '@/lib/booking/supabase-repo'

it('parseRange lê o formato tstzrange devolvido pelo PostgREST', () => {
  const i = parseRange('["2026-12-07 13:00:00+00","2026-12-07 13:30:00+00")')
  expect(i.start.toISOString()).toBe('2026-12-07T13:00:00.000Z')
  expect(i.end.toISOString()).toBe('2026-12-07T13:30:00.000Z')
  const j = parseRange('[2026-12-07 13:00:00+00,2026-12-07 13:30:00+00)')
  expect(j.end.toISOString()).toBe('2026-12-07T13:30:00.000Z')
})
