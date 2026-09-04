import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'DocForensic AI — Evidence Intelligence',
  description: 'AI-powered document verification, investigations, and forensic intelligence.',
  generator: 'DocForensic AI',
}

export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#101112', userScalable: false }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body className={`${geist.variable} antialiased`}>{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
