import { expect, it } from 'vitest'
import { buildDayStrip, formatLongDate } from '@/lib/dates'

it('formatLongDate escreve a data por extenso em pt-BR', () => {
  expect(formatLongDate('2026-12-12')).toBe('sábado, 12 de dezembro')
})

it('buildDayStrip lista os dias da janela e marca os fechados', () => {
  const days = buildDayStrip('2026-12-05', 3, [2, 3, 4, 5, 6]) // sáb, dom, seg, ter
  expect(days).toEqual([
    { date: '2026-12-05', weekdayShort: 'sáb', day: '5', monthShort: 'dez', open: true },
    { date: '2026-12-06', weekdayShort: 'dom', day: '6', monthShort: 'dez', open: false },
    { date: '2026-12-07', weekdayShort: 'seg', day: '7', monthShort: 'dez', open: false },
    { date: '2026-12-08', weekdayShort: 'ter', day: '8', monthShort: 'dez', open: true },
  ])
})
