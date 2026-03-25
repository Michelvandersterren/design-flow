'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#dc2626', marginBottom: 12 }}>Er is iets misgegaan</h2>
      <p style={{ color: '#6b7280', marginBottom: 20, fontSize: 14 }}>{error.message}</p>
      <button
        onClick={reset}
        style={{
          background: '#2563eb', color: '#fff', border: 'none',
          borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 14,
        }}
      >
        Opnieuw proberen
      </button>
    </div>
  )
}
