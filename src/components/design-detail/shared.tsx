import React, { useEffect } from 'react'
import type { Design, DesignMockup, DesignPrintFile } from './types'

// ─── Lightbox ────────────────────────────────────────────────────────────────
export function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain', cursor: 'default' }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 24,
          background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%',
          width: 40, height: 40, fontSize: 22, color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >{'\u00D7'}</button>
    </div>
  )
}

// ─── Workflow progress bar ────────────────────────────────────────────────────
const WORKFLOW_STAGES = [
  { key: 'design',      label: 'Design' },
  { key: 'variants',    label: 'Varianten' },
  { key: 'content',     label: 'Content' },
  { key: 'mockups',     label: 'Mockups' },
  { key: 'printfiles',  label: 'Printbestanden' },
  { key: 'shopify',     label: 'Shopify' },
]

export function WorkflowProgress({ design, savedMockups, savedPrintFiles }: {
  design: Design
  savedMockups: DesignMockup[]
  savedPrintFiles: DesignPrintFile[]
}) {
  const stages = [
    { key: 'design',     done: !!design.driveFileId },
    { key: 'variants',   done: design.variants.length > 0 },
    { key: 'content',    done: design.content.some((c) => c.language === 'nl') },
    { key: 'mockups',    done: savedMockups.length > 0 },
    { key: 'printfiles', done: savedPrintFiles.length > 0 },
    { key: 'shopify',    done: design.variants.some((v) => v.shopifyProductId) },
  ]

  const doneCount = stages.filter((s) => s.done).length

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {stages.map((stage, i) => {
          const label = WORKFLOW_STAGES[i].label
          const isLast = i === stages.length - 1
          return (
            <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0 0 auto' : 1 }}>
              {/* Step circle */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: stage.done ? '#10b981' : '#e5e7eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  color: stage.done ? '#fff' : '#9ca3af',
                  flexShrink: 0,
                  border: stage.done ? 'none' : '2px solid #d1d5db',
                  transition: 'background 0.2s',
                }}>
                  {stage.done ? '\u2713' : i + 1}
                </div>
                <span style={{ fontSize: 10, color: stage.done ? '#065f46' : '#9ca3af', whiteSpace: 'nowrap', fontWeight: stage.done ? 600 : 400 }}>
                  {label}
                </span>
              </div>
              {/* Connector line */}
              {!isLast && (
                <div style={{
                  flex: 1, height: 3, marginBottom: 16,
                  background: stage.done ? '#10b981' : '#e5e7eb',
                  transition: 'background 0.2s',
                }} />
              )}
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
        {doneCount} van {stages.length} stappen voltooid
      </p>
    </div>
  )
}

// ─── Small reusable sub-components ───────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
      {children}
    </p>
  )
}

export function DisabledHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16 }}>{'\u26A0'}</span>
      {children}
    </div>
  )
}

export function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 100
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 13, color: '#1d4ed8', marginBottom: 8 }}>{label}</div>
      <div style={{ background: '#dbeafe', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{
          background: '#2563eb', height: '100%',
          width: `${pct}%`,
          transition: 'width 0.3s',
          animation: current < total ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }} />
      </div>
      {total > 0 && <p style={{ fontSize: 11, color: '#3b82f6', marginTop: 6 }}>{current}/{total}</p>}
    </div>
  )
}

export function ActionRow({
  label, status, statusOk, hint, children,
}: {
  label: string
  status?: string
  statusOk?: boolean
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</div>
        {status && (
          <div style={{ fontSize: 11, color: statusOk ? '#16a34a' : '#6b7280', marginTop: 2 }}>
            {statusOk ? '\u2713 ' : ''}{status}
          </div>
        )}
        {hint && !status && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>{'\u26A0'} {hint}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export function ContentField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#374151' }}>{value}</p>
    </div>
  )
}

export function MockupCard({
  name, imgSrc, altText, viewUrl, isNew, skipped, skipReason,
  isRegenerating, canRegenerate, onRegenerate, onLightbox,
}: {
  name: string
  imgSrc: string
  altText: string
  viewUrl: string
  isNew?: boolean
  skipped?: boolean
  skipReason?: string
  isRegenerating: boolean
  canRegenerate: boolean
  onRegenerate: () => void
  onLightbox: () => void
}) {
  return (
    <div style={{
      border: `1px solid ${isNew ? '#bbf7d0' : '#e5e7eb'}`,
      borderRadius: 10,
      overflow: 'hidden',
      width: 240,
      background: isNew ? '#f0fdf4' : '#fff',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {skipped ? (
        <div style={{ padding: 12 }}>
          <p style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 4 }}>{name}</p>
          <p style={{ fontSize: 11, color: '#f59e0b' }}>Overgeslagen: {skipReason}</p>
        </div>
      ) : (
        <>
          {/* Thumbnail */}
          <div
            style={{ height: 180, overflow: 'hidden', background: '#f9fafb', cursor: 'zoom-in', position: 'relative' }}
            onClick={onLightbox}
          >
            <img
              src={imgSrc || undefined}
              alt={altText}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                const img = e.target as HTMLImageElement
                if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = viewUrl }
              }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.15s',
            }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0)' }}
            >
              <span style={{ color: '#fff', fontSize: 26 }}>{'\u2922'}</span>
            </div>
          </div>
          {/* Footer */}
          <div style={{ padding: '10px 12px' }}>
            <p style={{ fontWeight: 600, fontSize: 12, color: '#374151', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={altText}>
              {altText || <span style={{ color: '#d1d5db' }}>Geen alt-text</span>}
            </p>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '3px 8px', textDecoration: 'none', flex: 1, textAlign: 'center' }}
              >
                {'\u2197'} Drive
              </a>
              <button
                onClick={onRegenerate}
                disabled={!canRegenerate || isRegenerating}
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '3px 8px' }}
                title="Opnieuw genereren"
              >
                {isRegenerating ? '...' : '\u21BA'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
