import React from 'react'
import type { Design, DesignMockup, MockupGenerateResult, MockupStatus } from './types'
import { SectionLabel, DisabledHint, ProgressBar, MockupCard } from './shared'

interface MockupsTabProps {
  design: Design
  savedMockups: DesignMockup[]
  mockupStatus: MockupStatus | null
  newMockupResults: MockupGenerateResult[] | null
  generatingMockups: boolean
  deletingMockups: boolean
  regeneratingMockup: string | null
  mockupProgress: { current: number; total: number } | null
  onGenerateMockups: () => void
  onRegenerateMockup: (templateId: string) => void
  onDeleteAllMockups: () => void
  onLightbox: (src: string, alt: string) => void
}

export function MockupsTab({
  design, savedMockups, mockupStatus,
  newMockupResults, generatingMockups, deletingMockups, regeneratingMockup, mockupProgress,
  onGenerateMockups, onRegenerateMockup, onDeleteAllMockups, onLightbox,
}: MockupsTabProps) {
  const displayMockups: (DesignMockup & { isNew?: boolean } | MockupGenerateResult & { isNew?: boolean })[] =
    newMockupResults
      ? newMockupResults.map((r) => ({ ...r, isNew: true }))
      : savedMockups.map((m) => ({ ...m, isNew: false }))

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Mockups</h2>
          {mockupStatus && (
            <p style={{ fontSize: 12, color: mockupStatus.readyCount === mockupStatus.totalCount ? '#16a34a' : '#f59e0b', marginTop: 4 }}>
              PSD templates gereed: {mockupStatus.readyCount}/{mockupStatus.totalCount}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMockups.length > 0 && !generatingMockups && (
            <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={onDeleteAllMockups} disabled={deletingMockups}>
              {deletingMockups ? 'Verwijderen...' : 'Alle verwijderen'}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={onGenerateMockups}
            disabled={generatingMockups || design.variants.length === 0}
          >
            {generatingMockups ? 'Genereren...' : savedMockups.length > 0 ? 'Opnieuw genereren' : 'Genereer mockups'}
          </button>
        </div>
      </div>

      {design.variants.length === 0 && (
        <DisabledHint>Maak eerst varianten aan via het Overzicht-tabblad.</DisabledHint>
      )}

      {generatingMockups && mockupProgress && (
        <ProgressBar current={mockupProgress.current} total={mockupProgress.total} label="Photoshop werkt... (kan 10-20 minuten duren)" />
      )}

      {!generatingMockups && displayMockups.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>Nog geen mockups gegenereerd.</p>
      )}

      {displayMockups.length > 0 && (
        <>
          {/* Generic mockups */}
          {(() => {
            const generic = displayMockups.filter((r) => !(r as DesignMockup).sizeKey)
            if (generic.length === 0) return null
            return (
              <div style={{ marginBottom: 32 }}>
                <SectionLabel>Generieke mockups</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                  {generic.map((r) => {
                    const fileId = (r as DesignMockup).driveFileId || r.driveUrl.match(/[?&]id=([^&]+)/)?.[1] || r.driveUrl.match(/\/d\/([^/]+)\//)?.[1]
                    const viewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : r.driveUrl
                    const displayName = (r as MockupGenerateResult).label || (r as DesignMockup).outputName || r.outputName
                    const isRegen = regeneratingMockup === r.templateId
                    const imgSrc = fileId ? `/api/drive-image/${fileId}` : r.driveUrl
                    return (
                      <MockupCard
                        key={r.templateId}
                        name={displayName}
                        imgSrc={imgSrc}
                        altText={(r as DesignMockup).altText || displayName}
                        viewUrl={viewUrl}
                        isNew={(r as MockupGenerateResult & { isNew?: boolean }).isNew}
                        skipped={(r as MockupGenerateResult).skipped}
                        skipReason={(r as MockupGenerateResult).skipReason}
                        isRegenerating={isRegen}
                        canRegenerate={!regeneratingMockup && !generatingMockups}
                        onRegenerate={() => onRegenerateMockup(r.templateId)}
                        onLightbox={() => onLightbox(imgSrc, displayName)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Size-specific mockups */}
          {(() => {
            const sized = displayMockups.filter((r) => !!(r as DesignMockup).sizeKey)
            if (sized.length === 0) return null
            return (
              <div>
                <SectionLabel>Maat-specifieke mockups</SectionLabel>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                  {sized.map((m) => {
                    const fileId = (m as DesignMockup).driveFileId || m.driveUrl?.match(/[?&]id=([^&]+)/)?.[1] || m.driveUrl?.match(/\/d\/([^/]+)\//)?.[1]
                    const viewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : m.driveUrl
                    const displayName = (m as MockupGenerateResult).label || (m as DesignMockup).outputName || m.outputName
                    const imgSrc = fileId ? `/api/drive-image/${fileId}` : (m.driveUrl || '')
                    const sizeKey = (m as DesignMockup).sizeKey ?? (m as MockupGenerateResult).sizeKey
                    return (
                      <MockupCard
                        key={`${m.templateId}-${sizeKey}`}
                        name={displayName}
                        imgSrc={imgSrc}
                        altText={(m as DesignMockup).altText || displayName}
                        viewUrl={viewUrl}
                        skipped={(m as MockupGenerateResult).skipped}
                        skipReason={(m as MockupGenerateResult).skipReason}
                        isRegenerating={regeneratingMockup === m.templateId}
                        canRegenerate={!regeneratingMockup && !generatingMockups}
                        onRegenerate={() => onRegenerateMockup(m.templateId)}
                        onLightbox={() => onLightbox(imgSrc, displayName)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
