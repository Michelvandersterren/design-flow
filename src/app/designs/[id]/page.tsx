'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

import type {
  Design, DesignMockup, DesignPrintFile, MockupGenerateResult,
  PrintFileResult, VerifyResult, MockupStatus, TabId,
  Content, ContentEditFields,
} from '@/components/design-detail/types'
import { Lightbox, WorkflowProgress } from '@/components/design-detail/shared'
import { OverviewTab } from '@/components/design-detail/OverviewTab'
import { MockupsTab } from '@/components/design-detail/MockupsTab'
import { PrintFilesTab } from '@/components/design-detail/PrintFilesTab'
import { ContentTab } from '@/components/design-detail/ContentTab'
import { VariantsTab } from '@/components/design-detail/VariantsTab'
import { EditModal } from '@/components/design-detail/EditModal'

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DesignDetail() {
  const params = useParams()
  const router = useRouter()
  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const [generating, setGenerating] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ shopifyProductId?: string; handle?: string; error?: string } | null>(null)
  const [updatingShopify, setUpdatingShopify] = useState(false)
  const [updateShopifyResult, setUpdateShopifyResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)
  const [forking, setForking] = useState(false)
  const [approving, setApproving] = useState(false)
  const shopifyConfigured = process.env.NEXT_PUBLIC_SHOPIFY_CONFIGURED === 'true'

  const [generatingMockups, setGeneratingMockups] = useState(false)
  const [deletingMockups, setDeletingMockups] = useState(false)
  const [regeneratingMockup, setRegeneratingMockup] = useState<string | null>(null)
  const [mockupProgress, setMockupProgress] = useState<{ current: number; total: number } | null>(null)
  const [newMockupResults, setNewMockupResults] = useState<MockupGenerateResult[] | null>(null)
  const [mockupStatus, setMockupStatus] = useState<MockupStatus | null>(null)

  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  // Print file state
  const [generatingPrintFiles, setGeneratingPrintFiles] = useState(false)
  const [printProgress, setPrintProgress] = useState<{ current: number; total: number } | null>(null)
  const [regeneratingPrintFile, setRegeneratingPrintFile] = useState<string | null>(null)
  const [deletingPrintFiles, setDeletingPrintFiles] = useState(false)
  const [savedPrintFiles, setSavedPrintFiles] = useState<DesignPrintFile[]>([])
  const [newPrintFileResults, setNewPrintFileResults] = useState<PrintFileResult[] | null>(null)

  const [deleting, setDeleting] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<{
    designName: string
    designType: string
    styleFamily: string
    collections: string
    colorTags: string
    inductionFriendly: boolean
    circleFriendly: boolean
    splashFriendly: boolean
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const [contentEditMode, setContentEditMode] = useState<Record<string, boolean>>({})
  const [contentEditValues, setContentEditValues] = useState<Record<string, ContentEditFields>>({})
  const [contentSaving, setContentSaving] = useState<Record<string, boolean>>({})

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchDesign = useCallback(async () => {
    try {
      const res = await fetch(`/api/designs/${params.id}`)
      const data = await res.json()
      setDesign(data.design)
    } catch (error) {
      console.error('Error fetching design:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { fetchDesign() }, [fetchDesign])

  const fetchMockupStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`)
      const data = await res.json()
      setMockupStatus(data)
    } catch {}
  }, [params.id])

  useEffect(() => {
    if (design?.variants && design.variants.length > 0) fetchMockupStatus()
  }, [design?.variants?.length, fetchMockupStatus])

  const fetchPrintFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/designs/${params.id}/printfile`)
      const data = await res.json()
      if (data.printFiles) setSavedPrintFiles(data.printFiles)
    } catch {}
  }, [params.id])

  useEffect(() => {
    if (design?.id) fetchPrintFiles()
  }, [design?.id, fetchPrintFiles])

  // ─── Action handlers ────────────────────────────────────────────────────────

  const generateVariants = async () => {
    if (!design) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/designs/${params.id}/variants`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) fetchDesign()
    } catch (error) { console.error('Error generating variants:', error) }
    finally { setGenerating(false) }
  }

  const generateContent = async (productType: string) => {
    if (!design) return
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId: design.id, productType }),
      })
      const data = await res.json()
      if (data.success) fetchDesign()
      else alert('Content generatie mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Content generatie fout') }
    finally { setGenerating(false) }
  }

  const translateContent = async (language: string) => {
    if (!design) return
    setTranslating(language)
    try {
      const res = await fetch(`/api/designs/${params.id}/translate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }),
      })
      const data = await res.json()
      if (data.success) fetchDesign()
    } catch { console.error('Error translating') }
    finally { setTranslating(null) }
  }

  const forkDesign = async (targetType: 'IB' | 'SP' | 'MC') => {
    if (!design) return
    if (!confirm(`Nieuw ${targetType}-product aanmaken op basis van "${design.designName}"?`)) return
    setForking(true)
    try {
      const res = await fetch(`/api/designs/${params.id}/fork`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType }),
      })
      const data = await res.json()
      if (data.success) router.push(`/designs/${data.design.id}`)
      else if (data.existingId) {
        if (confirm(`Er bestaat al een ${targetType}-design. Wil je daarheen navigeren?`)) router.push(`/designs/${data.existingId}`)
      } else alert('Fork mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Fork fout') }
    finally { setForking(false) }
  }

  const deleteDesign = async () => {
    if (!design) return
    if (!confirm(`"${design.designName}" definitief verwijderen? Dit kan niet ongedaan worden.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/designs/${params.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/')
      } else {
        alert('Verwijderen mislukt: ' + (data.error || 'onbekende fout'))
      }
    } catch { alert('Verwijderen mislukt door netwerkfout') }
    finally { setDeleting(false) }
  }

  const publishToShopify = async () => {
    if (!design) return
    if (!confirm(`"${design.designName}" publiceren naar Shopify als conceptproduct?`)) return
    setPublishing(true)
    setPublishResult(null)
    try {
      const res = await fetch(`/api/designs/${params.id}/publish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        setPublishResult({ shopifyProductId: data.shopifyProductId, handle: data.shopifyProductHandle })
        fetchDesign()
      } else setPublishResult({ error: data.error || 'Publish mislukt' })
    } catch { setPublishResult({ error: 'Netwerkfout tijdens publiceren' }) }
    finally { setPublishing(false) }
  }

  const updateShopify = async () => {
    if (!design) return
    setUpdatingShopify(true)
    setUpdateShopifyResult(null)
    try {
      const res = await fetch(`/api/designs/${params.id}/shopify-update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) setUpdateShopifyResult({ success: true })
      else setUpdateShopifyResult({ error: data.error || 'Update mislukt' })
    } catch { setUpdateShopifyResult({ error: 'Netwerkfout tijdens update' }) }
    finally { setUpdatingShopify(false) }
  }

  const verifyShopify = async () => {
    if (!design) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await fetch(`/api/designs/${params.id}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.checks) setVerifyResult({ checks: data.checks, summary: data.summary, verifiedAt: data.verifiedAt })
      else setVerifyResult(null)
    } catch { alert('Verificatie mislukt') }
    finally { setVerifying(false) }
  }

  const generateMockups = async () => {
    if (!design) return
    setGeneratingMockups(true)
    setNewMockupResults(null)
    const total = mockupStatus?.totalCount ?? 0
    setMockupProgress({ current: 0, total })
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.results) {
        setNewMockupResults(data.results)
        setMockupProgress({ current: data.results.length, total: data.results.length })
        fetchDesign()
      } else alert('Mockup generatie mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Fout bij mockup generatie') }
    finally { setGeneratingMockups(false) }
  }

  const regenerateMockup = async (templateId: string) => {
    if (!design) return
    setRegeneratingMockup(templateId)
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId }),
      })
      const data = await res.json()
      if (data.results) fetchDesign()
      else alert('Hergenerate mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Fout bij hergenerate mockup') }
    finally { setRegeneratingMockup(null) }
  }

  const deleteAllMockups = async () => {
    if (!design) return
    if (!confirm('Alle mockups verwijderen? Je kunt ze daarna opnieuw genereren.')) return
    setDeletingMockups(true)
    setNewMockupResults(null)
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchDesign()
      else alert('Verwijderen mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Fout bij verwijderen mockups') }
    finally { setDeletingMockups(false) }
  }

  const generatePrintFiles = async () => {
    if (!design) return
    setGeneratingPrintFiles(true)
    setNewPrintFileResults(null)
    const ibVariants = design.variants.filter((v) => v.productType === 'IB')
    setPrintProgress({ current: 0, total: ibVariants.length })
    try {
      const res = await fetch(`/api/designs/${params.id}/printfile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.results) {
        setNewPrintFileResults(data.results)
        setPrintProgress({ current: data.results.length, total: data.results.length })
        fetchPrintFiles()
      } else alert('Printbestand generatie mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Fout bij printbestand generatie') }
    finally { setGeneratingPrintFiles(false) }
  }

  const regeneratePrintFile = async (sizeKey: string) => {
    if (!design) return
    setRegeneratingPrintFile(sizeKey)
    try {
      const res = await fetch(`/api/designs/${params.id}/printfile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sizeKey }),
      })
      const data = await res.json()
      if (data.results) fetchPrintFiles()
      else alert('Hergenerate mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Fout bij hergenerate printbestand') }
    finally { setRegeneratingPrintFile(null) }
  }

  const deleteAllPrintFiles = async () => {
    if (!design) return
    if (!confirm('Alle printbestanden verwijderen uit de database? Drive bestanden blijven bewaard.')) return
    setDeletingPrintFiles(true)
    setNewPrintFileResults(null)
    try {
      const res = await fetch(`/api/designs/${params.id}/printfile`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) setSavedPrintFiles([])
      else alert('Verwijderen mislukt: ' + (data.error || 'onbekende fout'))
    } catch { alert('Fout bij verwijderen printbestanden') }
    finally { setDeletingPrintFiles(false) }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!design) return
    setApproving(true)
    try {
      const res = await fetch(`/api/designs/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.design) setDesign(data.design)
    } catch {
      alert(`Status wijzigen naar ${newStatus} mislukt`)
    } finally {
      setApproving(false)
    }
  }

  // ─── Edit mode handlers ─────────────────────────────────────────────────────

  const openEditMode = () => {
    if (!design) return
    setEditForm({
      designName: design.designName,
      designType: design.designType ?? '',
      styleFamily: design.styleFamily ?? '',
      collections: design.collections ? JSON.parse(design.collections).join(', ') : '',
      colorTags: design.colorTags ? JSON.parse(design.colorTags).join(', ') : '',
      inductionFriendly: design.inductionFriendly,
      circleFriendly: design.circleFriendly,
      splashFriendly: design.splashFriendly,
    })
    setEditMode(true)
  }

  const saveEdit = async () => {
    if (!design || !editForm) return
    setSaving(true)
    try {
      const collectionsArr = editForm.collections.split(',').map((s) => s.trim()).filter(Boolean)
      const colorTagsArr = editForm.colorTags.split(',').map((s) => s.trim()).filter(Boolean)
      const res = await fetch(`/api/designs/${params.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, collections: JSON.stringify(collectionsArr), colorTags: JSON.stringify(colorTagsArr) }),
      })
      const data = await res.json()
      if (data.design) {
        setDesign((prev) => prev ? { ...prev, ...data.design } : data.design)
        setEditMode(false)
      }
    } catch { alert('Opslaan mislukt') }
    finally { setSaving(false) }
  }

  // ─── Content edit handlers ──────────────────────────────────────────────────

  const openContentEdit = (lang: string, c: Content) => {
    setContentEditValues((prev) => ({
      ...prev,
      [lang]: { description: c.description ?? '', longDescription: c.longDescription ?? '', seoTitle: c.seoTitle ?? '', seoDescription: c.seoDescription ?? '', googleShoppingDescription: c.googleShoppingDescription ?? '' },
    }))
    setContentEditMode((prev) => ({ ...prev, [lang]: true }))
  }

  const cancelContentEdit = (lang: string) => setContentEditMode((prev) => ({ ...prev, [lang]: false }))

  const saveContentEdit = async (lang: string) => {
    const values = contentEditValues[lang]
    if (!values) return
    setContentSaving((prev) => ({ ...prev, [lang]: true }))
    try {
      const res = await fetch(`/api/designs/${params.id}/content`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang, ...values }),
      })
      const data = await res.json()
      if (data.success) { setContentEditMode((prev) => ({ ...prev, [lang]: false })); fetchDesign() }
      else alert('Opslaan mislukt: ' + (data.error ?? 'onbekende fout'))
    } catch { alert('Netwerkfout bij opslaan') }
    finally { setContentSaving((prev) => ({ ...prev, [lang]: false })) }
  }

  const handleContentEditChange = (lang: string, field: keyof ContentEditFields, value: string) => {
    setContentEditValues((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }))
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'badge-draft'
      case 'REVIEW': return 'badge-review'
      case 'APPROVED': return 'badge-approved'
      case 'LIVE': return 'badge-live'
      case 'FAILED': return 'badge-failed'
      default: return ''
    }
  }

  if (loading) return <div className="loading">Laden...</div>
  if (!design) return <div className="container">Design niet gevonden</div>

  const savedMockups = design.mockups ?? []

  // Tab badge counts
  const tabBadges: Partial<Record<TabId, number>> = {
    mockups: savedMockups.length || undefined,
    printfiles: savedPrintFiles.length || undefined,
    content: design.content.length || undefined,
    variants: design.variants.length || undefined,
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="container">
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      {/* ── Sticky header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        marginBottom: 0,
        borderRadius: 0,
      }}>
        <div className="container" style={{ padding: '12px 20px' }}>
           {/* Breadcrumbs + title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>
              <Link href="/" style={{ color: '#6b7280', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#2563eb' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280' }}
              >Dashboard</Link>
              <span>/</span>
              <span style={{ color: '#374151', fontWeight: 500 }}>{design.designCode}</span>
            </nav>

            {/* Design thumbnail */}
            {design.driveFileId && (
              <img
                src={`/api/drive-image/${design.driveFileId}`}
                alt={design.designName}
                onClick={() => design.driveFileId && setLightbox({ src: `/api/drive-image/${design.driveFileId}`, alt: design.designName })}
                style={{
                  width: 56, height: 56,
                  objectFit: 'contain',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  cursor: 'zoom-in',
                  flexShrink: 0,
                }}
              />
            )}

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 18, margin: 0, lineHeight: 1.2 }}>{design.designName}</h1>
                <span className={`badge ${getStatusBadgeClass(design.status)}`}>{design.status}</span>
              </div>
              <p style={{ color: '#6b7280', margin: '2px 0 0', fontSize: 12 }}>
                <strong>{design.designCode}</strong>
                {design.designType && <> {'\u00B7'} {design.designType}</>}
                {design.styleFamily && <> {'\u00B7'} {design.styleFamily}</>}
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {design.status === 'REVIEW' && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={() => handleStatusChange('APPROVED')}
                    disabled={approving}
                    style={{ fontSize: 12, padding: '5px 12px' }}
                  >
                    {approving ? 'Bezig...' : 'Goedkeuren'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleStatusChange('DRAFT')}
                    disabled={approving}
                    style={{ fontSize: 12, padding: '5px 12px', color: '#dc2626', borderColor: '#dc2626' }}
                  >
                    Afwijzen
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={openEditMode} style={{ fontSize: 12, padding: '5px 12px' }}>
                Bewerken
              </button>
            </div>
          </div>

          {/* Workflow progress */}
          <div style={{ marginTop: 10 }}>
            <WorkflowProgress design={design} savedMockups={savedMockups} savedPrintFiles={savedPrintFiles} />
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: 12, borderTop: '1px solid #f3f4f6' }}>
            {([
              { id: 'overview',    label: 'Overzicht' },
              { id: 'variants',    label: 'Varianten' },
              { id: 'mockups',     label: 'Mockups' },
              { id: 'printfiles',  label: 'Printbestanden' },
              { id: 'content',     label: 'Content' },
            ] as { id: TabId; label: string }[]).map((tab) => {
              const badge = tabBadges[tab.id]
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                    color: active ? '#2563eb' : '#6b7280',
                    fontWeight: active ? 600 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'color 0.15s',
                    marginBottom: -1,
                  }}
                >
                  {tab.label}
                  {badge != null && badge > 0 && (
                    <span style={{
                      background: active ? '#2563eb' : '#e5e7eb',
                      color: active ? '#fff' : '#6b7280',
                      borderRadius: 20, fontSize: 10, fontWeight: 700,
                      padding: '1px 6px', lineHeight: '16px',
                    }}>{badge}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ paddingTop: 24 }}>

        {/* ── Edit modal ── */}
        {editMode && editForm && (
          <EditModal
            editForm={editForm}
            saving={saving}
            onClose={() => setEditMode(false)}
            onSave={saveEdit}
            onFormChange={setEditForm}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewTab
            design={design}
            savedMockups={savedMockups}
            savedPrintFiles={savedPrintFiles}
            mockupStatus={mockupStatus}
            publishResult={publishResult}
            updateShopifyResult={updateShopifyResult}
            verifyResult={verifyResult}
            generating={generating}
            generatingMockups={generatingMockups}
            generatingPrintFiles={generatingPrintFiles}
            publishing={publishing}
            updatingShopify={updatingShopify}
            verifying={verifying}
            forking={forking}
            deleting={deleting}
            approving={approving}
            shopifyConfigured={shopifyConfigured}
            onGenerateVariants={generateVariants}
            onGenerateContent={generateContent}
            onGenerateMockups={generateMockups}
            onGeneratePrintFiles={generatePrintFiles}
            onPublishToShopify={publishToShopify}
            onUpdateShopify={updateShopify}
            onVerifyShopify={verifyShopify}
            onForkDesign={forkDesign}
            onDeleteDesign={deleteDesign}
            onSetActiveTab={setActiveTab}
            onLightbox={(src, alt) => setLightbox({ src, alt })}
          />
        )}

        {activeTab === 'mockups' && (
          <MockupsTab
            design={design}
            savedMockups={savedMockups}
            mockupStatus={mockupStatus}
            newMockupResults={newMockupResults}
            generatingMockups={generatingMockups}
            deletingMockups={deletingMockups}
            regeneratingMockup={regeneratingMockup}
            mockupProgress={mockupProgress}
            onGenerateMockups={generateMockups}
            onRegenerateMockup={regenerateMockup}
            onDeleteAllMockups={deleteAllMockups}
            onLightbox={(src, alt) => setLightbox({ src, alt })}
          />
        )}

        {activeTab === 'printfiles' && (
          <PrintFilesTab
            design={design}
            savedPrintFiles={savedPrintFiles}
            newPrintFileResults={newPrintFileResults}
            generatingPrintFiles={generatingPrintFiles}
            deletingPrintFiles={deletingPrintFiles}
            regeneratingPrintFile={regeneratingPrintFile}
            printProgress={printProgress}
            onGeneratePrintFiles={generatePrintFiles}
            onRegeneratePrintFile={regeneratePrintFile}
            onDeleteAllPrintFiles={deleteAllPrintFiles}
          />
        )}

        {activeTab === 'content' && (
          <ContentTab
            design={design}
            generating={generating}
            translating={translating}
            contentEditMode={contentEditMode}
            contentEditValues={contentEditValues}
            contentSaving={contentSaving}
            onGenerateContent={generateContent}
            onTranslateContent={translateContent}
            onOpenContentEdit={openContentEdit}
            onCancelContentEdit={cancelContentEdit}
            onSaveContentEdit={saveContentEdit}
            onContentEditChange={handleContentEditChange}
          />
        )}

        {activeTab === 'variants' && (
          <VariantsTab
            design={design}
            generating={generating}
            onGenerateVariants={generateVariants}
          />
        )}

      </div>
    </div>
  )
}
