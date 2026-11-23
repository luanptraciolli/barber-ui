import type { Metadata, Viewport } from 'next'
import { Big_Shoulders, Instrument_Sans } from 'next/font/google'
import './globals.css'

const display = Big_Shoulders({ variable: '--font-display', subsets: ['latin'], weight: ['600', '800'] })
const sans = Instrument_Sans({ variable: '--font-body', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Agendar horário',
  description: 'Marque seu horário na barbearia em poucos toques.',
}

export const viewport: Viewport = { themeColor: '#0F3B2E', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${display.variable} ${sans.variable} antialiased`}>{children}</body>
    </html>
  )
}
