/** Normaliza telefone brasileiro: só dígitos, com DDD, sem o 55. Retorna null se inválido. */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2)
  }
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits.startsWith('0')) return null
  return digits
}

export function formatPhone(digits: string): string {
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  const split = rest.length === 9 ? 5 : 4
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`
}
