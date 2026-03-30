import React from 'react'
import type { Design, DesignMockup, DesignPrintFile, MockupGenerateResult, VerifyResult, MockupStatus } from './types'
import { ActionRow } from './shared'

interface OverviewTabProps {
  design: Design
  savedMockups: DesignMockup[]
  savedPrintFiles: DesignPrintFile[]
  mockupStatus: MockupStatus | null
  // Publish state
  publishResult: { shopifyProductId?: string; handle?: string; error?: string } | null
  updateShopifyResult: { success?: boolean; error?: string } | null
  verifyResult: VerifyResult | null
  // Loading states
  generating: boolean
  generatingMockups: boolean
  generatingPrintFiles: boolean
  publishing: boolean
  updatingShopify: boolean
  verifying: boolean
  forking: boolean
  deleting: boolean
  approving: boolean
  shopifyConfigured: boolean
  // Handlers
  onGenerateVariants: () => void
  onGenerateContent: (productType: string) => void
  onGenerateMockups: () => void
  onGeneratePrintFiles: () => void
  onPublishToShopify: () => void
  onUpdateShopify: () => void
  onVerifyShopify: () => void
  onForkDesign: (targetType: 'IB' | 'SP' | 'MC') => void
  onDeleteDesign: () => void
  onSetActiveTab: (tab: 'mockups' | 'printfiles') => void
  onLightbox: (src: string, alt: string) => void
}

function getProductType(d: Design): string {
  if (d.inductionFriendly) return 'INDUCTION'
  if (d.circleFriendly) return 'CIRCLE'
  if (d.splashFriendly) return 'SPLASH'
  return 'INDUCTION'
}

function getStepStatusClass(status: string) {
  switch (status) {
    case 'COMPLETED': return 'completed'
    case 'IN_PROGRESS': return 'in-progress'
    case 'FAILED': return 'failed'
    default: return 'pending'
  }
}

export function OverviewTab({
  design, savedMockups, savedPrintFiles, mockupStatus,
  publishResult, updateShopifyResult, verifyResult,
  generating, generatingMockups, generatingPrintFiles, publishing, updatingShopify, verifying, forking, deleting, approving,
  shopifyConfigured,
  onGenerateVariants, onGenerateContent, onGenerateMockups, onGeneratePrintFiles,
  onPublishToShopify, onUpdateShopify, onVerifyShopify,
  onForkDesign, onDeleteDesign, onSetActiveTab, onLightbox,
}: OverviewTabProps) {
  const nlContent = design.content.find((c) => c.language === 'nl')
  const shopifyVariantId = design.variants.find((v) => v.shopifyProductId)?.shopifyProductId
  const alreadyOnShopify = !!shopifyVariantId
  const allVariantsHaveEan = design.variants.length > 0 && design.variants.every((v) => v.ean)
  const hasMockups = (design.mockups ?? []).length > 0
  const isApproved = design.status === 'APPROVED'
  const canPublish = !!(shopifyConfigured && nlContent && design.variants.length > 0 && !alreadyOnShopify && design.status !== 'LIVE' && isApproved && hasMockups && allVariantsHaveEan)
  const hasPrintVariants = design.variants.some((v) => v.productType === 'IB' || v.productType === 'SP' || v.productType === 'MC')

  return (
    <div>
      {/* Publish banner */}
      {publishResult && (
        <div className="card" style={{ marginBottom: 20, borderLeft: `4px solid ${publishResult.error ? '#ef4444' : '#22c55e'}`, background: publishResult.error ? '#fef2f2' : '#f0fdf4' }}>
          {publishResult.error
            ? <p style={{ color: '#dc2626' }}>Publiceren mislukt: {publishResult.error}</p>
            : <p style={{ color: '#16a34a' }}>Gepubliceerd naar Shopify! Product ID: <strong>{publishResult.shopifyProductId}</strong>{publishResult.handle && <> {'\u2014'} Handle: <strong>{publishResult.handle}</strong></>}</p>
          }
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {/* Large design preview */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          {design.driveFileId ? (
            <>
              <img
                src={`/api/drive-image/${design.driveFileId}`}
                alt={design.designName}
                onClick={() => design.driveFileId && onLightbox(`/api/drive-image/${design.driveFileId}`, design.designName)}
                style={{
                  width: 160, height: 160,
                  objectFit: 'contain',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  cursor: 'zoom-in',
                }}
              />
              <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>Klik om te vergroten</p>
            </>
          ) : (
            <div style={{ width: 160, height: 160, borderRadius: 10, border: '2px dashed #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
              Geen afbeelding
            </div>
          )}
        </div>

        <div className="card">
          <h2>Producttypes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'inductionFriendly', label: 'Inductiebeschermer' },
              { key: 'circleFriendly', label: 'Muurcirkel' },
              { key: 'splashFriendly', label: 'Spatscherm' },
            ].map(({ key, label }) => {
              const on = design[key as keyof Design] as boolean
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: on ? '#10b981' : '#e5e7eb', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: on ? '#065f46' : '#9ca3af' }}>{label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <h2>Collecties & Kleuren</h2>
          <p style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>
            {design.collections ? JSON.parse(design.collections).join(', ') : <span style={{ color: '#9ca3af' }}>Geen collecties</span>}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {design.colorTags ? JSON.parse(design.colorTags).map((tag: string) => (
              <span key={tag} style={{ background: '#f3f4f6', color: '#374151', borderRadius: 12, padding: '2px 8px', fontSize: 11 }}>{tag}</span>
            )) : <span style={{ fontSize: 13, color: '#9ca3af' }}>Geen kleurtags</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 24 }}>
        {/* Workflow steps */}
        <div className="card">
          <h2>Workflowstappen</h2>
          <div className="workflow-steps">
            {design.workflowSteps.map((step) => (
              <span key={step.id} className={`step ${getStepStatusClass(step.status)}`}>
                {step.step.replace(/_/g, ' ')}
              </span>
            ))}
            {design.workflowSteps.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>Nog geen workflowstappen</p>}
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <h2>Acties</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stap 1: Varianten */}
            <ActionRow
              label="Varianten"
              status={design.variants.length > 0 ? `${design.variants.length} aangemaakt` : undefined}
              statusOk={design.variants.length > 0}
            >
              <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={onGenerateVariants} disabled={generating}>
                {generating ? 'Aanmaken...' : design.variants.length > 0 ? 'Opnieuw aanmaken' : 'Varianten aanmaken'}
              </button>
            </ActionRow>

            {/* Stap 2: Content */}
            <ActionRow
              label="NL Content"
              status={nlContent ? 'Gegenereerd' : undefined}
              statusOk={!!nlContent}
            >
              <button
                className={nlContent ? 'btn btn-secondary' : 'btn btn-success'}
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => onGenerateContent(getProductType(design))}
                disabled={generating}
              >
                {generating ? 'Genereren...' : nlContent ? 'Opnieuw genereren' : 'Genereren (AI)'}
              </button>
            </ActionRow>

            {/* Stap 3: Mockups */}
            <ActionRow
              label="Mockups"
              status={savedMockups.length > 0 ? `${savedMockups.length} gegenereerd` : undefined}
              statusOk={savedMockups.length > 0}
              hint={design.variants.length === 0 ? 'Maak eerst varianten aan' : undefined}
            >
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '5px 12px' }}
                onClick={() => { onSetActiveTab('mockups'); setTimeout(onGenerateMockups, 100) }}
                disabled={generatingMockups || design.variants.length === 0}
              >
                {generatingMockups ? 'Genereren...' : savedMockups.length > 0 ? 'Opnieuw genereren' : 'Genereren'}
              </button>
            </ActionRow>

            {/* Stap 4: Printbestanden */}
            {hasPrintVariants && (
              <ActionRow
                label="Printbestanden"
                status={savedPrintFiles.length > 0 ? `${savedPrintFiles.length} PDF's klaar` : undefined}
                statusOk={savedPrintFiles.length > 0}
                hint={!design.driveFileId ? 'Upload eerst een designbestand' : undefined}
              >
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={() => { onSetActiveTab('printfiles'); setTimeout(onGeneratePrintFiles, 100) }}
                  disabled={generatingPrintFiles || !design.driveFileId}
                >
                  {generatingPrintFiles ? 'Genereren...' : savedPrintFiles.length > 0 ? 'Opnieuw genereren' : 'Genereren'}
                </button>
              </ActionRow>
            )}

            {/* Stap 5: Shopify */}
            <ActionRow
              label="Shopify publiceren"
              status={alreadyOnShopify ? `Gepubliceerd \u00B7 ${shopifyVariantId}` : undefined}
              statusOk={alreadyOnShopify}
              hint={
                !shopifyConfigured ? 'Shopify niet geconfigureerd'
                : !nlContent ? 'NL content is vereist'
                : design.variants.length === 0 ? 'Varianten zijn vereist'
                : undefined
              }
            >
              {alreadyOnShopify ? (
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '5px 12px' }}
                  onClick={onUpdateShopify}
                  disabled={updatingShopify || !shopifyConfigured}
                  title="Vernieuw content en vertalingen op Shopify"
                >
                  {updatingShopify ? 'Bijwerken...' : 'Shopify bijwerken'}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '5px 12px', background: canPublish ? '#7c3aed' : undefined }}
                  onClick={onPublishToShopify}
                  disabled={publishing || !canPublish}
                >
                  {publishing ? 'Publiceren...' : 'Publiceren'}
                </button>
              )}
            </ActionRow>
            {!alreadyOnShopify && !canPublish && !publishing && (
              <div style={{ fontSize: 11, color: '#92400e', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginTop: -8 }}>
                {!isApproved && <div>Status moet APPROVED zijn (nu: {design.status})</div>}
                {!nlContent && <div>Nederlandse content ontbreekt</div>}
                {!hasMockups && <div>Mockups ontbreken</div>}
                {!allVariantsHaveEan && <div>Niet alle varianten hebben een EAN</div>}
                {design.variants.length === 0 && <div>Geen varianten aangemaakt</div>}
              </div>
            )}
            {updateShopifyResult && (
              <div style={{ padding: '6px 10px', borderRadius: 6, fontSize: 12, marginTop: -8,
                background: updateShopifyResult.error ? '#fef2f2' : '#f0fdf4',
                color: updateShopifyResult.error ? '#dc2626' : '#16a34a',
                border: `1px solid ${updateShopifyResult.error ? '#fca5a5' : '#86efac'}`,
              }}>
                {updateShopifyResult.error ? `Update mislukt: ${updateShopifyResult.error}` : 'Shopify bijgewerkt!'}
              </div>
            )}

            {/* Post-publish verificatie */}
            {alreadyOnShopify && (
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Shopify verificatie</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={onVerifyShopify}
                    disabled={verifying}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    {verifying ? 'Controleren...' : 'Verifi\u00EBren'}
                  </button>
                </div>
                {verifyResult && (
                  <div style={{ fontSize: 12 }}>
                    {/* Summary bar */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 10, padding: '6px 10px', borderRadius: 6, background: '#f9fafb' }}>
                      <span style={{ color: '#16a34a', fontWeight: 600 }}>{verifyResult.summary.pass} OK</span>
                      {verifyResult.summary.warn > 0 && (
                        <span style={{ color: '#d97706', fontWeight: 600 }}>{verifyResult.summary.warn} waarschuwing{verifyResult.summary.warn !== 1 ? 'en' : ''}</span>
                      )}
                      {verifyResult.summary.fail > 0 && (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>{verifyResult.summary.fail} fout{verifyResult.summary.fail !== 1 ? 'en' : ''}</span>
                      )}
                      <span style={{ color: '#9ca3af', marginLeft: 'auto', fontSize: 11 }}>
                        {new Date(verifyResult.verifiedAt).toLocaleTimeString('nl-NL')}
                      </span>
                    </div>
                    {/* Checks grouped by category */}
                    {(() => {
                      const issues = verifyResult.checks.filter((c) => c.status !== 'pass')
                      if (issues.length === 0) {
                        return (
                          <div style={{ padding: '8px 10px', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' }}>
                            Alle {verifyResult.checks.length} controles geslaagd
                          </div>
                        )
                      }
                      const categories = [...new Set(issues.map((c) => c.category))]
                      return categories.map((cat) => (
                        <div key={cat} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: 4 }}>
                            {cat}
                          </div>
                          {issues.filter((c) => c.category === cat).map((check, idx) => (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', fontSize: 12,
                              color: check.status === 'fail' ? '#dc2626' : '#92400e',
                            }}>
                              <span style={{ flexShrink: 0 }}>{check.status === 'fail' ? '\uD83D\uDD34' : '\uD83D\uDFE1'}</span>
                              <div>
                                <span style={{ fontWeight: 500 }}>{check.label}</span>
                                {check.expected && check.actual && (
                                  <span style={{ color: '#9ca3af' }}> {'\u2014'} verwacht: {check.expected}, gevonden: {check.actual}</span>
                                )}
                                {!check.expected && check.actual && (
                                  <span style={{ color: '#9ca3af' }}> {'\u2014'} {check.actual}</span>
                                )}
                                {check.detail && (
                                  <span style={{ color: '#9ca3af' }}> {'\u2014'} {check.detail}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Fork naar ander producttype */}
            {(() => {
              const otherTypes = ([
                { type: 'IB' as const, label: 'Inductiebeschermer', enabled: !design.inductionFriendly },
                { type: 'SP' as const, label: 'Spatscherm', enabled: !design.splashFriendly },
                { type: 'MC' as const, label: 'Muurcirkel', enabled: !design.circleFriendly },
              ] as const).filter((t) => t.enabled)
              if (otherTypes.length === 0) return null
              return (
                <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                  <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Variant aanmaken voor ander producttype:</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {otherTypes.map(({ type, label }) => (
                      <button
                        key={type}
                        className="btn btn-secondary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                        onClick={() => onForkDesign(type)}
                        disabled={forking}
                        title={`Nieuw ${label}-product aanmaken`}
                      >
                        {forking ? '...' : `+ ${type}`}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Design verwijderen */}
            {['DRAFT', 'REVIEW'].includes(design.status) && !alreadyOnShopify && (
              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: 12, padding: '5px 14px' }}
                  onClick={onDeleteDesign}
                  disabled={deleting}
                >
                  {deleting ? 'Verwijderen...' : 'Design verwijderen'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Missing PSD templates warning */}
      {mockupStatus && mockupStatus.readyCount < mockupStatus.totalCount && (
        <div className="card" style={{ marginBottom: 24, borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h2 style={{ color: '#92400e' }}>Ontbrekende PSD templates</h2>
          <ul style={{ fontSize: 12, color: '#78350f', margin: 0, paddingLeft: 20 }}>
            {mockupStatus.templates.filter((t) => !t.ready).map((t) => (
              <li key={t.id} style={{ marginBottom: 4 }}><code>{t.file}</code></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
