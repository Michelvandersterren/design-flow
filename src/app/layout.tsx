import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Design Flow - Product Workflow Manager',
  description: 'Intern operations-platform voor KitchenArt productlanceringen',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body>
        <Sidebar />
        <main className="app-shell">
          {children}
        </main>
      </body>
    </html>
  )
}
