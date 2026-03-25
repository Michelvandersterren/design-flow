import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Design Flow - Product Workflow Manager',
  description: 'Manage your print-on-demand product workflow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
