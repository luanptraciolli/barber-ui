'use client'

import { useState, useTransition } from 'react'
import type { WorkingHour } from '@/lib/availability'
import type { Settings } from '@/lib/booking/types'
import { formatPhone } from '@/lib/phone'
import { saveService, saveSettings, saveWorkingHours, type SaveResult } from './actions'

type ServiceRow = { id: string; name: string; duration_min: number; price_cents: number; active: boolean }
type HourRow = WorkingHour & { barberId: string }

const inputCls = 'w-full rounded-md border border-green-line bg-green-deep px-3 py-2.5 focus:border-brass focus:outline-none'
const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const centsToInput = (c: number) => (c / 100).toFixed(2).replace('.', ',')

function Feedback({ r }: { r: SaveResult | null }) {
  if (!r) return null
  if (!r.ok) return <p role="status" className="text-[#f0a3a7]">{r.error}</p>
  return (
    <p role="status" className="text-sage">
      Salvo.{r.warning && <span className="block text-brass">{r.warning}</span>}
    </p>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-green-line pt-6">
      <h2 className="mb-5 font-display text-3xl font-bold text-brass">{title}</h2>
      {children}
    </section>
  )
}

export function ConfigForms(p: { settings: Settings; services: ServiceRow[]; barbers: { id: string; name: string }[]; hours: HourRow[] }) {
  return (
    <>
      <ShopForm settings={p.settings} />
      <Section title="Serviços">
        <ul className="space-y-3">
          {p.services.map((s) => <li key={s.id}><ServiceForm service={s} /></li>)}
          <li><ServiceForm /></li>
        </ul>
      </Section>
      <Section title="Horário de trabalho">
        <div className="space-y-10">
          {p.barbers.map((b) => (
            <HoursForm key={b.id} barber={b} initial={p.hours.filter((h) => h.barberId === b.id)} />
          ))}
        </div>
      </Section>
    </>
  )
}

function ShopForm({ settings }: { settings: Settings }) {
  const [name, setName] = useState(settings.shopName)
  const [whatsapp, setWhatsapp] = useState(settings.whatsapp ? formatPhone(settings.whatsapp) : '')
  const [address, setAddress] = useState(settings.address)
  const [result, setResult] = useState<SaveResult | null>(null)
  const [pending, start] = useTransition()
  return (
    <Section title="Barbearia">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault()
        start(async () => setResult(await saveSettings({ shopName: name, whatsapp, address })))
      }}>
        <label className="block"><span className="mb-1 block text-sm text-sage">Nome</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="block"><span className="mb-1 block text-sm text-sage">WhatsApp que recebe as confirmações</span>
          <input className={inputCls} type="tel" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} required />
        </label>
        <label className="block"><span className="mb-1 block text-sm text-sage">Endereço</span>
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <div className="flex items-center gap-4">
          <button disabled={pending} className="rounded-md bg-brass px-5 py-2.5 font-semibold text-green-deep disabled:opacity-60">
            Salvar dados
          </button>
          <Feedback r={result} />
        </div>
      </form>
    </Section>
  )
}

function ServiceForm({ service }: { service?: ServiceRow }) {
  const [name, setName] = useState(service?.name ?? '')
  const [duration, setDuration] = useState(String(service?.duration_min ?? 30))
  const [price, setPrice] = useState(service ? centsToInput(service.price_cents) : '')
  const [active, setActive] = useState(service?.active ?? true)
  const [result, setResult] = useState<SaveResult | null>(null)
  const [pending, start] = useTransition()
  return (
    <form
      aria-label={service ? `Serviço ${service.name}` : 'Novo serviço'}
      className={`grid grid-cols-[1fr_5rem_6.5rem] items-end gap-2 rounded-md border border-green-line p-3 sm:grid-cols-[1fr_5rem_6.5rem_auto_auto] ${active ? '' : 'opacity-60'}`}
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await saveService({ id: service?.id, name, durationMin: Number(duration), price, active })
          setResult(r)
          if (r.ok && !service) { setName(''); setPrice('') }
        })
      }}
    >
      <label className="block"><span className="mb-1 block text-xs text-sage">{service ? 'Serviço' : 'Novo serviço'}</span>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block"><span className="mb-1 block text-xs text-sage">Minutos</span>
        <input className={inputCls} type="number" min={5} max={240} step={5} value={duration} onChange={(e) => setDuration(e.target.value)} required />
      </label>
      <label className="block"><span className="mb-1 block text-xs text-sage">Preço (R$)</span>
        <input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="45,00" required />
      </label>
      {service && (
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[#c9a227]" />
          Ativo
        </label>
      )}
      <button disabled={pending} className="rounded-md border border-brass px-4 py-2.5 text-brass hover:bg-brass hover:text-green-deep disabled:opacity-60">
        {service ? 'Salvar' : 'Adicionar'}
      </button>
      <div className="col-span-full"><Feedback r={result} /></div>
    </form>
  )
}

type DayState = { open: boolean; intervals: { start: string; end: string }[] }

function HoursForm({ barber, initial }: { barber: { id: string; name: string }; initial: HourRow[] }) {
  const [days, setDays] = useState<DayState[]>(() =>
    WEEKDAYS.map((_, wd) => {
      const list = initial.filter((h) => h.weekday === wd).map((h) => ({ start: h.start, end: h.end }))
      return { open: list.length > 0, intervals: list.length ? list : [{ start: '09:00', end: '19:00' }] }
    }),
  )
  const [result, setResult] = useState<SaveResult | null>(null)
  const [pending, start] = useTransition()
  const update = (wd: number, fn: (d: DayState) => DayState) => setDays((all) => all.map((d, i) => (i === wd ? fn(d) : d)))

  return (
    <form aria-label={`Horário de ${barber.name}`} onSubmit={(e) => {
      e.preventDefault()
      const hours = days.flatMap((d, wd) => (d.open ? d.intervals.map((iv) => ({ weekday: wd, ...iv })) : []))
      start(async () => setResult(await saveWorkingHours(barber.id, hours)))
    }}>
      <h3 className="mb-3 font-display text-2xl font-bold">{barber.name}</h3>
      <ul className="divide-y divide-green-line/60">
        {days.map((d, wd) => (
          <li key={wd} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
            <label className="flex w-28 items-center gap-2">
              <input type="checkbox" checked={d.open} aria-label={`${WEEKDAYS[wd]} aberto`}
                onChange={(e) => update(wd, (x) => ({ ...x, open: e.target.checked }))} className="size-4 accent-[#c9a227]" />
              {WEEKDAYS[wd]}
            </label>
            {d.open ? (
              <div className="flex flex-wrap items-center gap-2">
                {d.intervals.map((iv, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <input type="time" step={900} value={iv.start} aria-label={`${WEEKDAYS[wd]} início ${i + 1}`}
                      onChange={(e) => update(wd, (x) => ({ ...x, intervals: x.intervals.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)) }))}
                      className="rounded-md border border-green-line bg-green-deep px-2 py-1.5 tabular-nums" />
                    <span className="text-sage">às</span>
                    <input type="time" step={900} value={iv.end} aria-label={`${WEEKDAYS[wd]} fim ${i + 1}`}
                      onChange={(e) => update(wd, (x) => ({ ...x, intervals: x.intervals.map((y, j) => (j === i ? { ...y, end: e.target.value } : y)) }))}
                      className="rounded-md border border-green-line bg-green-deep px-2 py-1.5 tabular-nums" />
                  </span>
                ))}
                {d.intervals.length === 1 ? (
                  <button type="button" className="text-sm text-sage underline underline-offset-4 hover:text-bone"
                    onClick={() => update(wd, (x) => ({ ...x, intervals: [{ start: x.intervals[0].start, end: '12:00' }, { start: '13:00', end: x.intervals[0].end }] }))}>
                    Pausa para almoço
                  </button>
                ) : (
                  <button type="button" className="text-sm text-sage underline underline-offset-4 hover:text-bone"
                    onClick={() => update(wd, (x) => ({ ...x, intervals: [{ start: x.intervals[0].start, end: x.intervals[x.intervals.length - 1].end }] }))}>
                    Sem pausa
                  </button>
                )}
              </div>
            ) : (
              <span className="text-sage">Fechado</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-4">
        <button disabled={pending} className="rounded-md bg-brass px-5 py-2.5 font-semibold text-green-deep disabled:opacity-60">
          Salvar horário de {barber.name}
        </button>
        <Feedback r={result} />
      </div>
    </form>
  )
}
