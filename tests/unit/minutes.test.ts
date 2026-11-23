import { expect, it } from 'vitest'
import { minutesInTz, toMinutes } from '@/lib/time'

it('minutesInTz retorna minutos desde meia-noite em SP', () => {
  expect(minutesInTz('2026-12-08T12:30:00Z')).toBe(9 * 60 + 30)
})
it('toMinutes converte HH:mm', () => {
  expect(toMinutes('13:45')).toBe(13 * 60 + 45)
})
