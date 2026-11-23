import { expect, it } from 'vitest'
import { whatsappLink } from '@/lib/whatsapp'

it('monta link wa.me com DDI 55 e texto codificado', () => {
  expect(whatsappLink('11987654321', 'Olá, tudo bem?')).toBe(
    'https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F',
  )
})
