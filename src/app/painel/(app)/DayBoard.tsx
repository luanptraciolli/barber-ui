'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { AgendaItem } from '@/lib/booking/agenda'
import { groupByBarber } from '@/lib/booking/agenda'
import type { BlockItem, HoursRow } from '@/lib/booking/agenda-loader'
import { BOOKING_ERRORS } from '@/lib/booking/errors'
import type { Barber, Service, SlotOption } from '@/lib/booking/types'
import { formatPhone } from '@/lib/phone'
import { formatTime, minutesInTz, toMinutes, weekdayOf } from '@/lib/time'
import { whatsappLink } from '@/lib/whatsapp'
import { cancelAppointment, createBlock, createManualBooking, deleteBlock, panelSlots } from './actions'

const PX = 1.6 // pixels por minuto

type Props = {
  date: string
  items: AgendaItem[]
  blocks: BlockItem[]
  barbers: Barber[]
  services: Service[]
  hours: HoursRow[]
}

export function DayBoard({ date, items, blocks, barbers, services, hours }: Props) {
  const weekday = weekdayOf(date)
  const todays = hours.filter((h) => h.weekday === weekday)
  const open = todays.length > 0
  const rangeStart = open ? Math.min(...todays.map((h) => toMinutes(h.start))) : 9 * 60
  const rangeEnd = open ? Math.max(...todays.map((h) => toMinutes(h.end))) : 19 * 60
  const grouped = groupByBarber(items, barbers)
  const [selected, setSelected] = useState<AgendaItem | null>(null)
  const [selectedBlock, setSelectedBlock] = useState<BlockItem | null>(null)
  const [dialog, setDialog] = useState<'new' | 'block' | null>(null)

  const top = (iso: string) => Math.max(0, (minutesInTz(iso) - rangeStart) * PX)
  const height = (a: string, b: string) => Math.max(18, (minutesInTz(b) - minutesInTz(a)) * PX - 2)
  const hourMarks: number[] = []
  for (let m = Math.ceil(rangeStart / 60) * 60; m <= rangeEnd; m += 60) hourMarks.push(m)

  return (
    <>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={() => setDialog('new')}
          className="rounded-md bg-brass px-4 py-2.5 font-semibold text-green-deep hover:bg-[#d9b23a]">
          Novo agendamento
        </button>
        <button type="button" onClick={() => setDialog('block')}
          className="rounded-md border border-green-line px-4 py-2.5 hover:border-sage">
          Bloquear horário
        </button>
      </div>

      {!open && <p className="mt-6 text-sage">A barbearia não abre neste dia.</p>}

      <div className="mt-6 grid gap-2" style={{ gridTemplateColumns: `2.5rem repeat(${barbers.length}, minmax(0, 1fr))` }}>
        <div />
        {barbers.map((b) => (
          <div key={b.id} className="border-b border-green-line pb-2 font-display text-xl font-bold">{b.name}</div>
        ))}

        <div className="relative" style={{ height: (rangeEnd - rangeStart) * PX }}>
          {hourMarks.map((m) => (
            <span key={m} className="absolute -translate-y-1/2 text-xs text-sage tabular-nums" style={{ top: (m - rangeStart) * PX }}>
              {String(m / 60).padStart(2, '0')}h
            </span>
          ))}
        </div>

        {barbers.map((b) => (
          <div key={b.id} className="relative" style={{ height: (rangeEnd - rangeStart) * PX }}>
            {hourMarks.map((m) => (
              <div key={m} className="absolute inset-x-0 border-t border-green-line/60" style={{ top: (m - rangeStart) * PX }} />
            ))}
            {blocks.filter((x) => x.barberId === null || x.barberId === b.id).map((x) => (
              <button key={x.id} type="button" onClick={() => setSelectedBlock(x)}
                className="absolute inset-x-0 overflow-hidden rounded-sm border border-sage/40 px-2 py-1 text-left text-xs text-sage"
                style={{
                  top: top(x.start), height: height(x.start, x.end),
                  backgroundImage: 'repeating-linear-gradient(-45deg, transparent 0 6px, rgba(143,168,154,.18) 6px 8px)',
                }}>
                {x.reason || 'Bloqueado'}
              </button>
            ))}
            {grouped[b.id].map((a) => (
              <button key={a.id} type="button" onClick={() => setSelected(a)}
                className="absolute inset-x-0 overflow-hidden rounded-sm border-l-4 border-brass bg-green-line px-2 py-1 text-left leading-tight hover:bg-[#286150]"
                style={{ top: top(a.start), height: height(a.start, a.end) }}>
                <span className="text-xs text-sage tabular-nums">{formatTime(a.start)}</span>{' '}
                <span className="text-sm font-semibold">{a.customerName}</span>
                <span className="block truncate text-xs text-sage">{a.serviceName}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {selected && <AppointmentDialog item={selected} barber={barbers.find((b) => b.id === selected.barberId)} onClose={() => setSelected(null)} />}
      {selectedBlock && <BlockDetailDialog block={selectedBlock} onClose={() => setSelectedBlock(null)} />}
      {dialog === 'new' && <NewBookingDialog date={date} barbers={barbers} services={services} onClose={() => setDialog(null)} />}
      {dialog === 'block' && <BlockDialog date={date} barbers={barbers} onClose={() => setDialog(null)} />}
    </>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  return (
    <dialog
      ref={(el) => {
        ref.current = el
        if (el && !el.open) el.showModal()
      }}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-green-line bg-green p-0 text-bone backdrop:bg-black/60"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-3xl font-bold">{title}</h2>
          <button type="button" onClick={() => ref.current?.close()} className="px-2 text-2xl text-sage hover:text-bone" aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

function AppointmentDialog({ item, barber, onClose }: { item: AgendaItem; barber?: Barber; onClose: () => void }) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
  return (
    <Modal title={item.customerName} onClose={onClose}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-sage">Horário</dt><dd className="tabular-nums">{formatTime(item.start)} – {formatTime(item.end)}</dd>
        <dt className="text-sage">Serviço</dt><dd>{item.serviceName}</dd>
        <dt className="text-sage">Barbeiro</dt><dd>{barber?.name}</dd>
        <dt className="text-sage">Telefone</dt><dd>{formatPhone(item.customerPhone)}</dd>
        <dt className="text-sage">Origem</dt><dd>{item.source === 'online' ? 'Pelo site' : 'Marcado no painel'}</dd>
      </dl>
      <div className="mt-6 flex flex-wrap gap-2">
        <a href={whatsappLink(item.customerPhone, `Olá ${item.customerName.split(' ')[0]}, aqui é da barbearia.`)}
          target="_blank" rel="noopener noreferrer"
          className="rounded-md bg-[#25d366] px-4 py-2.5 font-semibold text-[#06301b]">
          Chamar no WhatsApp
        </a>
        {!confirming ? (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-md border border-pole/70 px-4 py-2.5 text-[#f0a3a7]">
            Cancelar horário
          </button>
        ) : (
          <button type="button" disabled={pending}
            onClick={() => start(async () => { await cancelAppointment(item.id); onClose() })}
            className="rounded-md bg-pole px-4 py-2.5 font-semibold text-bone disabled:opacity-60">
            {pending ? 'Cancelando…' : 'Confirmar cancelamento'}
          </button>
        )}
      </div>
    </Modal>
  )
}

function BlockDetailDialog({ block, onClose }: { block: BlockItem; onClose: () => void }) {
  const [pending, start] = useTransition()
  return (
    <Modal title={block.reason || 'Horário bloqueado'} onClose={onClose}>
      <p className="tabular-nums">{formatTime(block.start)} – {formatTime(block.end)}</p>
      <p className="text-sm text-sage">{block.barberId ? 'Só este barbeiro' : 'Barbearia inteira'}</p>
      <button type="button" disabled={pending}
        onClick={() => start(async () => { await deleteBlock(block.id); onClose() })}
        className="mt-6 rounded-md border border-green-line px-4 py-2.5 hover:border-sage disabled:opacity-60">
        {pending ? 'Removendo…' : 'Remover bloqueio'}
      </button>
    </Modal>
  )
}

const inputCls = 'w-full rounded-md border border-green-line bg-green-deep px-3 py-2.5 focus:border-brass focus:outline-none'

function NewBookingDialog({ date, barbers, services, onClose }: { date: string; barbers: Barber[]; services: Service[]; onClose: () => void }) {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? '')
  const [slots, setSlots] = useState<SlotOption[] | null>(null)
  const [slot, setSlot] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  const load = (sId: string, bId: string) => {
    setSlot('')
    setSlots(null)
    start(async () => setSlots(await panelSlots(sId, bId, date)))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(serviceId, barberId), [])

  return (
    <Modal title="Novo agendamento" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault()
        setError('')
        start(async () => {
          const r = await createManualBooking({ serviceId, barberId, start: slot, customerName: name, customerPhone: phone })
          if (r.ok) return onClose()
          setError(BOOKING_ERRORS[r.error])
          if (r.error === 'SLOT_TAKEN') load(serviceId, barberId)
        })
      }}>
        <label className="block"><span className="mb-1 block text-sm text-sage">Serviço</span>
          <select className={inputCls} value={serviceId} onChange={(e) => { setServiceId(e.target.value); load(e.target.value, barberId) }}>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMin} min)</option>)}
          </select>
        </label>
        <label className="block"><span className="mb-1 block text-sm text-sage">Barbeiro</span>
          <select className={inputCls} value={barberId} onChange={(e) => { setBarberId(e.target.value); load(serviceId, e.target.value) }}>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="mb-1 text-sm text-sage">Horário</legend>
          {slots === null ? <p className="text-sage">Buscando horários…</p>
            : slots.length === 0 ? <p className="text-sage">Nenhum horário livre neste dia.</p>
            : (
              <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto">
                {slots.map((s) => (
                  <button key={s.start} type="button" onClick={() => setSlot(s.start)}
                    className={`rounded-md border py-2 tabular-nums ${slot === s.start ? 'border-brass bg-brass text-green-deep' : 'border-green-line hover:border-sage'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
        </fieldset>
        <label className="block"><span className="mb-1 block text-sm text-sage">Nome do cliente</span>
          <input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block"><span className="mb-1 block text-sm text-sage">WhatsApp com DDD</span>
          <input required type="tel" inputMode="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {error && <p className="text-[#f0a3a7]">{error}</p>}
        <button type="submit" disabled={pending || !slot}
          className="w-full rounded-md bg-brass px-4 py-3 font-semibold text-green-deep disabled:opacity-50">
          Marcar horário
        </button>
      </form>
    </Modal>
  )
}

function BlockDialog({ date, barbers, onClose }: { date: string; barbers: Barber[]; onClose: () => void }) {
  const [barberId, setBarberId] = useState('')
  const [startTime, setStartTime] = useState('12:00')
  const [endTime, setEndTime] = useState('13:00')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  return (
    <Modal title="Bloquear horário" onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await createBlock({ barberId: barberId || null, date, startTime, endTime, reason })
          if (r.ok) return onClose()
          setError(r.error ?? '')
        })
      }}>
        <label className="block"><span className="mb-1 block text-sm text-sage">Quem</span>
          <select className={inputCls} value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">Barbearia inteira</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-sm text-sage">Das</span>
            <input type="time" step={900} required className={inputCls} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="block"><span className="mb-1 block text-sm text-sage">Até</span>
            <input type="time" step={900} required className={inputCls} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
        </div>
        <label className="block"><span className="mb-1 block text-sm text-sage">Motivo (opcional)</span>
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: véspera de Natal" />
        </label>
        {error && <p className="text-[#f0a3a7]">{error}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded-md bg-brass px-4 py-3 font-semibold text-green-deep disabled:opacity-50">
          {pending ? 'Bloqueando…' : 'Bloquear'}
        </button>
      </form>
    </Modal>
  )
}
