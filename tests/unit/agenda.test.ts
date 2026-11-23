import { expect, it } from 'vitest'
import { groupByBarber, type AgendaItem } from '@/lib/booking/agenda'

const item = (id: string, barberId: string, start: string): AgendaItem => ({
  id, barberId, serviceName: 'Corte', customerName: 'X', customerPhone: '11987654321',
  start, end: start, status: 'confirmed', source: 'online',
})

it('agrupa por barbeiro em ordem de horário, incluindo barbeiro sem itens', () => {
  const g = groupByBarber(
    [item('3', 'a', '2026-12-08T15:00:00Z'), item('1', 'a', '2026-12-08T12:00:00Z'), item('2', 'b', '2026-12-08T13:00:00Z')],
    [{ id: 'a', name: 'A', photoUrl: null }, { id: 'b', name: 'B', photoUrl: null }, { id: 'c', name: 'C', photoUrl: null }],
  )
  expect(g.a.map((i) => i.id)).toEqual(['1', '3'])
  expect(g.b.map((i) => i.id)).toEqual(['2'])
  expect(g.c).toEqual([])
})
