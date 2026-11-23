import { expect, it } from 'vitest'
import { parsePriceToCents, validateDuration, validateHours } from '@/lib/config-validation'

it('parsePriceToCents aceita formatos brasileiros', () => {
  expect(parsePriceToCents('45,00')).toBe(4500)
  expect(parsePriceToCents('45')).toBe(4500)
  expect(parsePriceToCents('R$ 1.234,50')).toBe(123450)
  expect(parsePriceToCents('abc')).toBeNull()
  expect(parsePriceToCents('-5')).toBeNull()
})

it('validateDuration exige múltiplo de 5 entre 5 e 240', () => {
  expect(validateDuration(30)).toBe(true)
  expect(validateDuration(7)).toBe(false)
  expect(validateDuration(0)).toBe(false)
  expect(validateDuration(245)).toBe(false)
})

it('validateHours rejeita fim antes do início e sobreposição no mesmo dia', () => {
  expect(validateHours([{ weekday: 1, start: '12:00', end: '09:00' }])).toBe('O fim precisa ser depois do início.')
  expect(validateHours([
    { weekday: 2, start: '09:00', end: '12:00' },
    { weekday: 2, start: '11:00', end: '15:00' },
  ])).toBe('Os intervalos de um mesmo dia não podem se sobrepor.')
  expect(validateHours([
    { weekday: 2, start: '09:00', end: '12:00' },
    { weekday: 2, start: '13:00', end: '19:00' },
  ])).toBeNull()
})

import { countOutsideHours } from '@/lib/config-validation'
import { atTime } from '@/lib/time'

it('countOutsideHours conta agendamentos fora do novo expediente', () => {
  const hours = [{ weekday: 2, start: '09:00', end: '12:00' }]
  const appts = [
    { start: atTime('2026-12-08', '10:00'), end: atTime('2026-12-08', '10:30') }, // terça, dentro
    { start: atTime('2026-12-08', '11:45'), end: atTime('2026-12-08', '12:15') }, // passa do fim
    { start: atTime('2026-12-10', '10:00'), end: atTime('2026-12-10', '10:30') }, // quinta, fechado
  ]
  expect(countOutsideHours(appts, hours)).toBe(2)
})
