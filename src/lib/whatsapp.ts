export function whatsappLink(phoneDigits: string, text: string): string {
  return `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(text)}`
}
