import { expect, it } from 'vitest'
import { formatBRL } from '@/lib/money'

it('formata centavos em reais', () => {
  expect(formatBRL(4500)).toBe('R$ 45,00')
  expect(formatBRL(1550)).toBe('R$ 15,50')
})
