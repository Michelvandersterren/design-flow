import React from 'react'
import type { Design, DesignPrintFile, PrintFileResult } from './types'
import { DisabledHint, ProgressBar } from './shared'

interface PrintFilesTabProps {
  design: Design
  savedPrintFiles: DesignPrintFile[]
  newPrintFileResults: PrintFileResult[] | null
  generatingPrintFiles: boolean
  deletingPrintFiles: boolean
  regeneratingPrintFile: string | null
  printProgress: { current: number; total: number } | null
  onGeneratePrintFiles: () => void
  onRegeneratePrintFile: (sizeKey: string) => void
  onDeleteAllPrintFiles: () => void
}

export function PrintFilesTab({
  design, savedPrintFiles,
  newPrintFileResults, generatingPrintFiles, deletingPrintFiles, regeneratingPrintFile, printProgress,
  onGeneratePrintFiles, onRegeneratePrintFile, onDeleteAllPrintFiles,
}: PrintFilesTabProps) {
  const hasPrintVariants = design.variants.some((v) => v.productType === 'IB' || v.productType === 'SP' || v.productType === 'MC')

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>Printbestanden</h2>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Productie-klare PDF's met CutContour, 10mm bleed, 150 dpi
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {savedPrintFiles.length > 0 && (
            <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={onDeleteAllPrintFiles} disabled={deletingPrintFiles}>
              {deletingPrintFiles ? 'Verwijderen...' : 'Alle verwijderen'}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={onGeneratePrintFiles}
            disabled={generatingPrintFiles || !design.driveFileId || !hasPrintVariants}
          >
            {generatingPrintFiles ? 'Genereren...' : savedPrintFiles.length > 0 ? 'Opnieuw genereren' : 'Genereer printbestanden'}
          </button>
        </div>
      </div>

      {!hasPrintVariants && (
        <DisabledHint>Genereer eerst varianten (IB, SP of MC) voordat je printbestanden kunt aanmaken.</DisabledHint>
      )}
      {hasPrintVariants && !design.driveFileId && (
        <DisabledHint>Upload eerst een designbestand voordat je printbestanden kunt genereren.</DisabledHint>
      )}

      {generatingPrintFiles && printProgress && (
        <ProgressBar current={printProgress.current} total={printProgress.total} label="PDF's worden gegenereerd via pdf-lib..." />
      )}

      {(() => {
        const displayFiles = newPrintFileResults ?? savedPrintFiles
        if (displayFiles.length === 0 && !generatingPrintFiles) {
          return <p style={{ color: '#9ca3af', fontSize: 13 }}>Nog geen printbestanden gegenereerd.</p>
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayFiles.map((file) => {
              const isResult = 'skipped' in file
              const sizeKey = file.sizeKey
              const fileName = file.fileName
              const driveUrl = file.driveUrl
              const skipped = isResult ? (file as PrintFileResult).skipped : false
              const skipReason = isResult ? (file as PrintFileResult).skipReason : undefined
              const isRegen = regeneratingPrintFile === sizeKey
              const createdAt = !isResult ? (file as DesignPrintFile).createdAt : undefined

              return (
                <div
                  key={sizeKey || fileName}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 16px',
                    border: `1px solid ${skipped ? '#fecaca' : '#e5e7eb'}`,
                    borderRadius: 8,
                    background: skipped ? '#fef2f2' : '#fff',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  {/* PDF icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                    background: skipped ? '#fecaca' : '#fee2e2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: skipped ? '#991b1b' : '#dc2626', letterSpacing: 0.5 }}>PDF</span>
                  </div>

                  {/* File info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: skipped ? '#991b1b' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileName || `ib-${design.designCode.toLowerCase()}-${sizeKey?.replace('x', '-')}.pdf`}
                    </div>
                    {skipped ? (
                      <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{skipReason}</div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, display: 'flex', gap: 12 }}>
                        <span>{file.widthMM}{'\u00D7'}{file.heightMM} mm</span>
                        <span style={{ color: '#d1d5db' }}>{'\u00B7'}</span>
                        <span style={{ fontFamily: 'monospace' }}>{sizeKey}</span>
                        {createdAt && (
                          <>
                            <span style={{ color: '#d1d5db' }}>{'\u00B7'}</span>
                            <span>{new Date(createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    {!skipped && driveUrl && (
                      <a
                        href={driveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '5px 12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span style={{ fontSize: 13 }}>{'\u2197'}</span> Drive
                      </a>
                    )}
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '5px 12px' }}
                      onClick={() => onRegeneratePrintFile(sizeKey)}
                      disabled={isRegen || generatingPrintFiles}
                      title="Printbestand opnieuw genereren"
                    >
                      {isRegen ? '...' : '\u21BA Opnieuw'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
