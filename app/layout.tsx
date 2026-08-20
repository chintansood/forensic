import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'DocForensic AI — Explainable document intelligence',
  description: 'AI-powered document fraud detection and forensic investigation for finance and operations teams.',
  generator: 'DocForensic AI',
}

export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#07111e', userScalable: false }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-[#07111e]"><body className={`${geist.variable} antialiased`}>{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
