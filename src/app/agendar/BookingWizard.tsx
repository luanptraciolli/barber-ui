'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import type { Catalog } from '@/lib/booking/catalog'
import type { BookingResult, SlotOption } from '@/lib/booking/types'
import { buildDayStrip, formatLongDate } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { dateInTz, formatTime } from '@/lib/time'
import { whatsappLink } from '@/lib/whatsapp'
import { BOOKING_ERRORS } from '@/lib/booking/errors'
import { fetchSlots, submitBooking } from './actions'


const STEPS = ['Serviço', 'Barbeiro', 'Dia e horário', 'Seus dados', 'Confirmado']

export function BookingWizard({ catalog, today }: { catalog: Catalog; today: string }) {
  const { settings, services, barbers, openWeekdays } = catalog
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const serviceId = params.get('s') ?? ''
  const barberId = params.get('b') ?? ''
  const date = params.get('d') ?? ''
  const slotStart = params.get('t') ?? ''

  const service = services.find((s) => s.id === serviceId)
  const barber = barbers.find((b) => b.id === barberId)

  const [slots, setSlots] = useState<SlotOption[] | null>(null)
  const [slotsFailed, setSlotsFailed] = useState(false)
  const [loadingSlots, startSlots] = useTransition()
  const [submitting, startSubmit] = useTransition()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<Extract<BookingResult, { ok: true }> | null>(null)

  const go = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(next)) {
      if (v === null) q.delete(k)
      else q.set(k, v)
    }
    router.push(`${pathname}?${q.toString()}`, { scroll: true })
  }

  const step = done ? 4 : !service ? 0 : !barberId ? 1 : !slotStart ? 2 : 3

  const weekdays = useMemo(() => {
    if (barberId === 'any') return [...new Set(Object.values(openWeekdays).flat())]
    return openWeekdays[barberId] ?? []
  }, [barberId, openWeekdays])
  const days = useMemo(
    () => buildDayStrip(today, settings.bookingWindowDays, weekdays),
    [today, settings.bookingWindowDays, weekdays],
  )
  const activeDate = date || days.find((d) => d.open)?.date || ''

  const loadSlots = (d: string) =>
    startSlots(async () => {
      setSlots(null)
      setSlotsFailed(false)
      const r = await fetchSlots(serviceId, barberId, d)
      if (r === null) setSlotsFailed(true)
      else setSlots(r)
    })

  useEffect(() => {
    if (step === 2 && activeDate) loadSlots(activeDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, activeDate, serviceId, barberId])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    startSubmit(async () => {
      const r = await submitBooking({ serviceId, barberId, start: slotStart, customerName: name, customerPhone: phone })
      if (r.ok) return setDone(r)
      setError(BOOKING_ERRORS[r.error])
      if (r.error === 'SLOT_TAKEN') go({ t: null })
    })
  }

  return (
    <main className="mx-auto min-h-dvh max-w-xl px-5 pb-16">
      <div className="-mx-5 h-3 bg-green-deep" role="progressbar" aria-valuemin={1} aria-valuemax={5}
        aria-valuenow={step + 1} aria-label={`Passo ${step + 1} de 5: ${STEPS[step]}`}>
        <div className="pole h-full transition-[width] duration-500" style={{ width: `${((step + 1) / 5) * 100}%` }} />
      </div>

      <nav className="flex items-center justify-between pt-5 text-sm text-sage">
        {step > 0 && step < 4 ? (
          <button type="button" onClick={() => router.back()} className="py-2 pr-4 hover:text-bone">
            Voltar
          </button>
        ) : (
          <Link href="/" className="py-2 pr-4 hover:text-bone">{settings.shopName}</Link>
        )}
        <span>Passo {step + 1} de 5</span>
      </nav>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-pole/60 bg-pole/15 px-4 py-3 text-bone">
          {error}
        </p>
      )}

      {step === 0 && (
        <Step title="Qual serviço?">
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.id}>
                <Choice onClick={() => go({ s: s.id })}>
                  <span>
                    <span className="block text-lg">{s.name}</span>
                    <span className="text-sm text-sage">{s.durationMin} min</span>
                  </span>
                  <span className="font-display text-xl font-semibold tabular-nums">{formatBRL(s.priceCents)}</span>
                </Choice>
              </li>
            ))}
          </ul>
        </Step>
      )}

      {step === 1 && (
        <Step title="Com quem?">
          <ul className="space-y-2">
            {barbers.map((b) => (
              <li key={b.id}>
                <Choice onClick={() => go({ b: b.id })}>
                  <span className="flex items-center gap-4">
                    <span aria-hidden className="grid size-11 place-items-center rounded-full bg-green-line font-display text-xl font-bold">
                      {b.name[0]}
                    </span>
                    <span className="text-lg">{b.name}</span>
                  </span>
                </Choice>
              </li>
            ))}
            <li>
              <Choice onClick={() => go({ b: 'any' })}>
                <span>
                  <span className="block text-lg">Sem preferência</span>
                  <span className="text-sm text-sage">Mostra os horários de todos</span>
                </span>
              </Choice>
            </li>
          </ul>
        </Step>
      )}

      {step === 2 && (
        <Step title="Quando?">
          <div className="-mx-5 overflow-x-auto px-5 pb-2" role="listbox" aria-label="Dia">
            <div className="flex gap-2">
              {days.map((d) => {
                const selected = d.date === activeDate
                return (
                  <button
                    key={d.date}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={!d.open}
                    onClick={() => go({ d: d.date })}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-md border py-2 transition-colors ${
                      selected
                        ? 'border-brass bg-brass text-green-deep'
                        : 'border-green-line hover:border-sage disabled:opacity-35 disabled:hover:border-green-line'
                    }`}
                  >
                    <span className="text-xs">{d.weekdayShort}</span>
                    <span className="font-display text-2xl leading-tight font-bold">{d.day}</span>
                    <span className="text-xs">{d.monthShort}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {activeDate && <p className="mt-6 mb-3 text-sage first-letter:uppercase">{formatLongDate(activeDate)}</p>}

          {!activeDate ? (
            <p className="py-8 text-sage">Nenhum dia disponível para agendamento. Fale com a barbearia pelo WhatsApp.</p>
          ) : slotsFailed && !loadingSlots ? (
            <div className="py-8">
              <p className="text-bone">Não foi possível carregar os horários.</p>
              <button type="button" onClick={() => loadSlots(activeDate)}
                className="mt-3 rounded-md border border-brass px-4 py-2.5 text-brass hover:bg-brass hover:text-green-deep">
                Tentar de novo
              </button>
            </div>
          ) : loadingSlots || slots === null ? (
            <p className="py-8 text-sage">Buscando horários livres…</p>
          ) : slots.length === 0 ? (
            <p className="py-8 text-sage">Nenhum horário livre neste dia. Escolha outro dia acima.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2">
              {slots.map((s) => (
                <li key={s.start}>
                  <button
                    type="button"
                    onClick={() => { setError(''); go({ d: activeDate, t: s.start }) }}
                    className="w-full rounded-md border border-green-line py-3 font-display text-xl font-semibold tabular-nums hover:border-brass hover:text-brass"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Step>
      )}

      {step === 3 && service && (
        <Step title="Seus dados">
          <Summary
            service={service.name}
            barber={barberId === 'any' ? 'Sem preferência' : barber?.name ?? ''}
            when={`${formatLongDate(dateInTz(new Date(slotStart)))} às ${formatTime(slotStart)}`}
            price={formatBRL(service.priceCents)}
          />
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Field label="Nome" value={name} onChange={setName} autoComplete="name" />
            <Field label="WhatsApp com DDD" value={phone} onChange={setPhone} type="tel" autoComplete="tel"
              inputMode="tel" placeholder="(11) 98765-4321" />
            <p className="text-sm text-sage">Usamos seu nome e telefone apenas para gerenciar seu agendamento.</p>
            <button type="submit" disabled={submitting}
              className="w-full rounded-md bg-brass px-6 py-4 text-lg font-semibold text-green-deep hover:bg-[#d9b23a] disabled:opacity-60">
              {submitting ? 'Confirmando…' : 'Confirmar agendamento'}
            </button>
          </form>
        </Step>
      )}

      {step === 4 && done && service && (
        <Step title="Horário confirmado">
          <Summary
            service={service.name}
            barber={done.barberName}
            when={`${formatLongDate(dateInTz(new Date(done.start)))} às ${formatTime(done.start)}`}
            price={formatBRL(service.priceCents)}
          />
          <a
            href={whatsappLink(
              settings.whatsapp,
              `Olá! Agendei ${service.name} com ${done.barberName} em ${formatLongDate(dateInTz(new Date(done.start)))} às ${formatTime(done.start)}. Nome: ${name.trim()}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 block rounded-md bg-[#25d366] px-6 py-4 text-center text-lg font-semibold text-[#06301b]"
          >
            Enviar confirmação no WhatsApp
          </a>
          <p className="mt-4 text-sm text-sage">Para remarcar ou cancelar, fale com a barbearia pelo WhatsApp.</p>
          <Link href="/" className="mt-8 inline-block text-sage underline underline-offset-4 hover:text-bone">
            Voltar ao início
          </Link>
        </Step>
      )}
    </main>
  )
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-6">
      <h1 className="mb-6 font-display text-5xl leading-none font-extrabold">{title}</h1>
      {children}
    </section>
  )
}

function Choice({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 border-b border-green-line py-4 text-left hover:text-brass"
    >
      {children}
    </button>
  )
}

function Summary(p: { service: string; barber: string; when: string; price: string }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-green-line py-4">
      <dt className="text-sage">Serviço</dt><dd>{p.service}</dd>
      <dt className="text-sage">Barbeiro</dt><dd>{p.barber}</dd>
      <dt className="text-sage">Quando</dt><dd className="first-letter:uppercase">{p.when}</dd>
      <dt className="text-sage">Valor</dt><dd>{p.price}</dd>
    </dl>
  )
}

function Field(p: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoComplete?: string
  inputMode?: 'tel'
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-sage">{p.label}</span>
      <input
        required
        type={p.type ?? 'text'}
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        autoComplete={p.autoComplete}
        inputMode={p.inputMode}
        placeholder={p.placeholder}
        className="w-full rounded-md border border-green-line bg-green-deep px-4 py-3 text-lg text-bone placeholder:text-sage/50 focus:border-brass focus:outline-none"
      />
    </label>
  )
}
