import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from '@/lib/phone'

describe('normalizePhone', () => {
  it('aceita formatos comuns e retorna só dígitos com DDD', () => {
    expect(normalizePhone('(11) 98765-4321')).toBe('11987654321')
    expect(normalizePhone('+55 11 98765 4321')).toBe('11987654321')
    expect(normalizePhone('11987654321')).toBe('11987654321')
    expect(normalizePhone('1132654321')).toBe('1132654321')
  })
  it('rejeita telefone sem DDD ou inválido', () => {
    expect(normalizePhone('98765-4321')).toBeNull()
    expect(normalizePhone('abc')).toBeNull()
  })
})

describe('formatPhone', () => {
  it('formata celular', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
  })
  it('formata fixo', () => {
    expect(formatPhone('1132654321')).toBe('(11) 3265-4321')
  })
})
