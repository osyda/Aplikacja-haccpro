import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HACCPro — Elektroniczne rejestry HACCP',
  description: 'Prowadź rejestry HACCP elektronicznie. Temperatura, dostawy, mycie, szkolenia — wszystko w jednym miejscu.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'HACCPro',
  },
}

export const viewport: Viewport = {
  themeColor: '#1B2E4B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
