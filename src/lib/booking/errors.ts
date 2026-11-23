import type { BookingError } from './types'

export const BOOKING_ERRORS: Record<BookingError, string> = {
  SLOT_TAKEN: 'Esse horário acabou de ser reservado, escolha outro.',
  TOO_MANY: 'Você já tem 3 horários marcados. Fale com a barbearia pelo WhatsApp.',
  INVALID_PHONE: 'Informe um telefone com DDD.',
  INVALID_NAME: 'Informe seu nome.',
  OUT_OF_RANGE: 'Data fora do período de agendamento.',
  NOT_FOUND: 'Serviço indisponível.',
}
