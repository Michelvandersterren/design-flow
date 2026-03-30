'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'

interface DesignMockup {
  id: string
  templateId: string
  outputName: string
  productType: string
  sizeKey?: string | null
  driveFileId: string
  driveUrl: string
  altText: string | null
  createdAt: string
}

interface Content {
  id: string
  language: string
  description: string | null
  longDescription: string | null
  seoTitle: string | null
  seoDescription: string | null
  googleShoppingDescription: string | null
  translationStatus: string
}

interface Variant {
  id: string
  productType: string
  size: string
  material: string | null
  sku: string
  ean: string | null
  price: number | null
  weight: number | null
  shopifyProductId: string | null
  shopifyVariantId: string | null
}

interface WorkflowStep {
  id: string
  step: string
  status: string
  completedAt: string | null
}

interface Design {
  id: string
  designCode: string
  designName: string
  designType: string | null
  styleFamily: string | null
  collections: string | null
  colorTags: string | null
  status: string
  inductionFriendly: boolean
  circleFriendly: boolean
  splashFriendly: boolean
  notionId: string | null
  driveFileId: string | null
  driveFileName: string | null
  variants: Variant[]
  content: Content[]
  workflowSteps: WorkflowStep[]
  mockups: DesignMockup[]
}

interface MockupGenerateResult {
  templateId: string
  outputName: string
  label?: string
  sizeKey?: string
  driveFileId: string
  driveUrl: string
  skipped?: boolean
  skipReason?: string
}

interface DesignPrintFile {
  id: string
  productType: string
  sizeKey: string
  widthMM: number
  heightMM: number
  fileName: string
  driveFileId: string
  driveUrl: string
  createdAt: string
}

interface PrintFileResult {
  sizeKey: string
  widthMM: number
  heightMM: number
  driveFileId: string
  driveUrl: string
  fileName: string
  skipped?: boolean
  skipReason?: string
}

type TabId = 'overview' | 'mockups' | 'printfiles' | 'content' | 'variants'

// ─── Lightbox ────────────────────────────────────────────────────────────────
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
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
      >×</button>
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

function WorkflowProgress({ design, savedMockups, savedPrintFiles }: {
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
                  {stage.done ? '✓' : i + 1}
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
  const [forking, setForking] = useState(false)
  const [approving, setApproving] = useState(false)
  const shopifyConfigured = process.env.NEXT_PUBLIC_SHOPIFY_CONFIGURED === 'true'

  const [generatingMockups, setGeneratingMockups] = useState(false)
  const [deletingMockups, setDeletingMockups] = useState(false)
  const [regeneratingMockup, setRegeneratingMockup] = useState<string | null>(null)
  const [mockupProgress, setMockupProgress] = useState<{ current: number; total: number } | null>(null)
  const [newMockupResults, setNewMockupResults] = useState<MockupGenerateResult[] | null>(null)
  const [mockupStatus, setMockupStatus] = useState<{ readyCount: number; totalCount: number; templates: { id: string; file: string; ready: boolean }[] } | null>(null)

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

  type ContentEditFields = { description: string; longDescription: string; seoTitle: string; seoDescription: string; googleShoppingDescription: string }
  const [contentEditMode, setContentEditMode] = useState<Record<string, boolean>>({})
  const [contentEditValues, setContentEditValues] = useState<Record<string, ContentEditFields>>({})
  const [contentSaving, setContentSaving] = useState<Record<string, boolean>>({})

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

  const getStepStatusClass = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'completed'
      case 'IN_PROGRESS': return 'in-progress'
      case 'FAILED': return 'failed'
      default: return 'pending'
    }
  }

  const getProductType = (d: Design): string => {
    if (d.inductionFriendly) return 'INDUCTION'
    if (d.circleFriendly) return 'CIRCLE'
    if (d.splashFriendly) return 'SPLASH'
    return 'INDUCTION'
  }

  if (loading) return <div className="loading">Laden...</div>
  if (!design) return <div className="container">Design niet gevonden</div>

  const nlContent = design.content.find((c) => c.language === 'nl')
  const deContent = design.content.find((c) => c.language === 'de')
  const enContent = design.content.find((c) => c.language === 'en')

  const shopifyVariantId = design.variants.find((v) => v.shopifyProductId)?.shopifyProductId
  const alreadyOnShopify = !!shopifyVariantId
  const allVariantsHaveEan = design.variants.length > 0 && design.variants.every((v) => v.ean)
  const hasMockups = (design.mockups ?? []).length > 0
  const isApproved = design.status === 'APPROVED'
  const canPublish = !!(shopifyConfigured && nlContent && design.variants.length > 0 && !alreadyOnShopify && design.status !== 'LIVE' && isApproved && hasMockups && allVariantsHaveEan)

  const savedMockups = design.mockups ?? []
  const displayMockups: (DesignMockup & { isNew?: boolean } | MockupGenerateResult & { isNew?: boolean })[] =
    newMockupResults
      ? newMockupResults.map((r) => ({ ...r, isNew: true }))
      : savedMockups.map((m) => ({ ...m, isNew: false }))

  const hasIB = design.variants.some((v) => v.productType === 'IB')
  const hasPrintVariants = design.variants.some((v) => v.productType === 'IB' || v.productType === 'SP' || v.productType === 'MC')

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
                {design.designType && <> · {design.designType}</>}
                {design.styleFamily && <> · {design.styleFamily}</>}
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
              { id: 'mockups',     label: 'Mockups' },
              { id: 'printfiles',  label: 'Printbestanden' },
              { id: 'content',     label: 'Content' },
              { id: 'variants',    label: 'Varianten' },
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
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', margin: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0 }}>Design bewerken</h2>
                <button onClick={() => setEditMode(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280' }}>×</button>
              </div>
              <div className="form-group">
                <label>Naam</label>
                <input value={editForm.designName} onChange={(e) => setEditForm({ ...editForm, designName: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Stijlfamilie</label>
                <input value={editForm.styleFamily} onChange={(e) => setEditForm({ ...editForm, styleFamily: e.target.value })} placeholder="bijv. Modern, Botanisch" />
              </div>
              <div className="form-group">
                <label>Collecties (komma-gescheiden)</label>
                <input value={editForm.collections} onChange={(e) => setEditForm({ ...editForm, collections: e.target.value })} placeholder="bijv. Lente, Natuur" />
              </div>
              <div className="form-group">
                <label>Kleurtags (komma-gescheiden)</label>
                <input value={editForm.colorTags} onChange={(e) => setEditForm({ ...editForm, colorTags: e.target.value })} placeholder="bijv. Groen, Blauw" />
              </div>
              <div className="form-group">
                <label>Producttypes</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  {[
                    { key: 'inductionFriendly', label: 'Inductiebeschermer' },
                    { key: 'circleFriendly', label: 'Muurcirkel' },
                    { key: 'splashFriendly', label: 'Spatscherm' },
                  ].map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={editForm[key as keyof typeof editForm] as boolean}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Opslaan...' : 'Opslaan'}</button>
                <button className="btn btn-secondary" onClick={() => setEditMode(false)}>Annuleren</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ OVERZICHT */}
        {activeTab === 'overview' && (
          <div>
            {/* Publish banner */}
            {publishResult && (
              <div className="card" style={{ marginBottom: 20, borderLeft: `4px solid ${publishResult.error ? '#ef4444' : '#22c55e'}`, background: publishResult.error ? '#fef2f2' : '#f0fdf4' }}>
                {publishResult.error
                  ? <p style={{ color: '#dc2626' }}>Publiceren mislukt: {publishResult.error}</p>
                  : <p style={{ color: '#16a34a' }}>Gepubliceerd naar Shopify! Product ID: <strong>{publishResult.shopifyProductId}</strong>{publishResult.handle && <> — Handle: <strong>{publishResult.handle}</strong></>}</p>
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
                      onClick={() => design.driveFileId && setLightbox({ src: `/api/drive-image/${design.driveFileId}`, alt: design.designName })}
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
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 12px' }} onClick={generateVariants} disabled={generating}>
                      {generating ? 'Aanmaken...' : design.variants.length > 0 ? 'Opnieuw aanmaken' : 'Varianten aanmaken'}
                    </button>
                  </ActionRow>

                  {/* Stap 2: Content */}
                  <ActionRow
                    label="NL Content"
                    status={nlContent ? 'Gegenereerd' : undefined}
                    statusOk={!!nlContent}
                    hint={!nlContent ? undefined : undefined}
                  >
                    <button
                      className={nlContent ? 'btn btn-secondary' : 'btn btn-success'}
                      style={{ fontSize: 12, padding: '5px 12px' }}
                      onClick={() => generateContent(getProductType(design))}
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
                      onClick={() => { setActiveTab('mockups'); setTimeout(generateMockups, 100) }}
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
                        onClick={() => { setActiveTab('printfiles'); setTimeout(generatePrintFiles, 100) }}
                        disabled={generatingPrintFiles || !design.driveFileId}
                      >
                        {generatingPrintFiles ? 'Genereren...' : savedPrintFiles.length > 0 ? 'Opnieuw genereren' : 'Genereren'}
                      </button>
                    </ActionRow>
                  )}

                  {/* Stap 5: Shopify */}
                  <ActionRow
                    label="Shopify publiceren"
                    status={alreadyOnShopify ? `Gepubliceerd · ${shopifyVariantId}` : undefined}
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
                        onClick={updateShopify}
                        disabled={updatingShopify || !shopifyConfigured}
                        title="Vernieuw content en vertalingen op Shopify"
                      >
                        {updatingShopify ? 'Bijwerken...' : 'Shopify bijwerken'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '5px 12px', background: canPublish ? '#7c3aed' : undefined }}
                        onClick={publishToShopify}
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
                              onClick={() => forkDesign(type)}
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

                  {/* Design verwijderen — alleen DRAFT/REVIEW en niet op Shopify */}
                  {['DRAFT', 'REVIEW'].includes(design.status) && !alreadyOnShopify && (
                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                      <button
                        className="btn btn-danger"
                        style={{ fontSize: 12, padding: '5px 14px' }}
                        onClick={deleteDesign}
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
        )}

        {/* ═══════════════════════════════════════════════════════════ MOCKUPS */}
        {activeTab === 'mockups' && (
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
                  <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={deleteAllMockups} disabled={deletingMockups}>
                    {deletingMockups ? 'Verwijderen...' : 'Alle verwijderen'}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={generateMockups}
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
                              onRegenerate={() => regenerateMockup(r.templateId)}
                              onLightbox={() => setLightbox({ src: imgSrc, alt: displayName })}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Size-specific mockups — flat grid */}
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
                              onRegenerate={() => regenerateMockup(m.templateId)}
                              onLightbox={() => setLightbox({ src: imgSrc, alt: displayName })}
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
        )}

        {/* ═══════════════════════════════════════════════════════════ PRINTBESTANDEN */}
        {activeTab === 'printfiles' && (
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
                  <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={deleteAllPrintFiles} disabled={deletingPrintFiles}>
                    {deletingPrintFiles ? 'Verwijderen...' : 'Alle verwijderen'}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={generatePrintFiles}
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
                              <span>{file.widthMM}×{file.heightMM} mm</span>
                              <span style={{ color: '#d1d5db' }}>·</span>
                              <span style={{ fontFamily: 'monospace' }}>{sizeKey}</span>
                              {createdAt && (
                                <>
                                  <span style={{ color: '#d1d5db' }}>·</span>
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
                              <span style={{ fontSize: 13 }}>↗</span> Drive
                            </a>
                          )}
                          <button
                            className="btn btn-secondary"
                            style={{ fontSize: 11, padding: '5px 12px' }}
                            onClick={() => regeneratePrintFile(sizeKey)}
                            disabled={isRegen || generatingPrintFiles}
                            title="Printbestand opnieuw genereren"
                          >
                            {isRegen ? '...' : '↺ Opnieuw'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ CONTENT */}
        {activeTab === 'content' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Shopify Metafields — read-only overzicht */}
          {nlContent && (() => {
            const firstType = design.variants[0]?.productType
            const materialPlain: Record<string, string> = { IB: 'Vinyl', MC: 'Aluminium-Dibond', SP: 'Aluminium-Dibond' }
            const materialFull: Record<string, string> = { IB: 'Vinyl texture overlay', MC: 'Aluminium-Dibond matte', SP: 'Aluminium-Dibond matte' }
            const firstMockupFileId = design.mockups?.[0]?.driveFileId ?? null
            const fields: { label: string; ns: string; key: string; value: string | null }[] = [
              { label: 'custom.manufacturer',          ns: 'custom', key: 'manufacturer',          value: 'probo' },
              { label: 'custom.modelnaam',              ns: 'custom', key: 'modelnaam',              value: design.designName },
              { label: 'custom.color_plain',            ns: 'custom', key: 'color_plain',            value: (() => {
                const parseF = (v: string | null): string[] => { if (!v) return []; try { const p = JSON.parse(v); if (Array.isArray(p)) return p.map(String).filter(Boolean) } catch {} return v.split(',').map(s => s.trim()).filter(Boolean) }
                const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
                return parseF(design.colorTags).map(cap).join(', ') || 'Multicolor'
              })() },
              { label: 'custom.google_custom_product',  ns: 'custom', key: 'google_custom_product',  value: 'True' },
              { label: 'custom.material',               ns: 'custom', key: 'material',               value: firstType ? (materialFull[firstType] ?? null) : null },
              { label: 'custom.material_plain',         ns: 'custom', key: 'material_plain',         value: firstType ? (materialPlain[firstType] ?? null) : null },
              { label: 'custom.beschrijving_afbeelding',ns: 'custom', key: 'beschrijving_afbeelding',value: firstMockupFileId },
              { label: 'custom.product_information',    ns: 'custom', key: 'product_information',    value: nlContent.description },
              { label: 'custom.marketplace_description',ns: 'custom', key: 'marketplace_description',value: nlContent.longDescription ? '(HTML versie van lange beschrijving)' : null },
              { label: 'custom.long_description',      ns: 'custom', key: 'long_description',      value: nlContent.longDescription ? '(Rich text versie van lange beschrijving)' : null },
              { label: 'custom.google_description',     ns: 'custom', key: 'google_description',     value: nlContent.googleShoppingDescription },
              { label: 'global.title_tag',              ns: 'global', key: 'title_tag',              value: nlContent.seoTitle },
              { label: 'global.description_tag',        ns: 'global', key: 'description_tag',        value: nlContent.seoDescription },
              { label: 'mm-google-shopping.condition',   ns: 'mm-google-shopping', key: 'condition',   value: 'new' },
              { label: 'mm-google-shopping.gender',      ns: 'mm-google-shopping', key: 'gender',      value: 'unisex' },
              { label: 'mm-google-shopping.age_group',   ns: 'mm-google-shopping', key: 'age_group',   value: 'adult' },
            ]
            return (
              <div className="card" style={{ marginBottom: 0 }}>
                <h2 style={{ marginTop: 0, marginBottom: 14 }}>Shopify Metafields (product)</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '4px 16px' }}>
                  {fields.map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'monospace' }}>{label}</span>
                      {value
                        ? <span style={{ fontSize: 12, color: '#374151', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value}</span>
                        : <span style={{ fontSize: 12, color: '#d1d5db', marginTop: 2, fontStyle: 'italic' }}>— niet ingevuld</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {(['nl', 'de', 'en'] as const).map((lang) => {
              const c = lang === 'nl' ? nlContent : lang === 'de' ? deContent : enContent
              const editing = contentEditMode[lang]
              const vals = contentEditValues[lang]
              const isSaving = contentSaving[lang]
              const langLabel = { nl: 'Nederlands', de: 'Deutsch', en: 'English' }[lang]

              return (
                <div className="card" key={lang}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h2 style={{ margin: 0 }}>
                      <span style={{ fontSize: 16, marginRight: 6 }}>{lang === 'nl' ? '🇳🇱' : lang === 'de' ? '🇩🇪' : '🇬🇧'}</span>
                      {langLabel}
                    </h2>
                    {c && !editing && (
                      <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => openContentEdit(lang, c)}>Bewerken</button>
                    )}
                  </div>

                  {c ? (
                    editing && vals ? (
                      <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { field: 'seoTitle' as const, label: 'SEO Title', type: 'input' },
                          { field: 'seoDescription' as const, label: 'SEO Description', type: 'textarea2' },
                          { field: 'googleShoppingDescription' as const, label: 'Google Shopping', type: 'input' },
                          { field: 'description' as const, label: 'Korte beschrijving', type: 'textarea3' },
                          { field: 'longDescription' as const, label: 'Lange beschrijving', type: 'textarea6' },
                        ].map(({ field, label, type }) => (
                          <div className="form-group" style={{ margin: 0 }} key={field}>
                            <label style={{ fontSize: 11 }}>{label}</label>
                            {type === 'input'
                              ? <input value={vals[field]} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], [field]: e.target.value } }))} />
                              : <textarea rows={type === 'textarea6' ? 6 : type === 'textarea3' ? 3 : 2} value={vals[field]} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], [field]: e.target.value } }))} style={{ resize: 'vertical' }} />
                            }
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary btn-sm" onClick={() => saveContentEdit(lang)} disabled={isSaving}>{isSaving ? 'Opslaan...' : 'Opslaan'}</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => cancelContentEdit(lang)} disabled={isSaving}>Annuleren</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <ContentField label="SEO Title" value={c.seoTitle} />
                          <ContentField label="SEO Description" value={c.seoDescription} />
                          <ContentField label="Google Shopping" value={c.googleShoppingDescription} />
                        </div>
                        <details style={{ marginTop: 12 }}>
                          <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: 12 }}>Korte beschrijving tonen</summary>
                          <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{c.description}</p>
                        </details>
                        {c.longDescription && (
                          <details style={{ marginTop: 8 }}>
                            <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: 12 }}>Lange beschrijving tonen</summary>
                            <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{c.longDescription}</p>
                          </details>
                        )}
                        {c.translationStatus && lang !== 'nl' && (
                          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Status: {c.translationStatus}</p>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                          {lang === 'nl' && (
                            <>
                              <button className="btn btn-secondary btn-sm" onClick={() => generateContent(getProductType(design))} disabled={generating}>
                                {generating ? 'Genereren...' : 'Opnieuw genereren'}
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => translateContent('de')} disabled={translating === 'de'}>
                                {translating === 'de' ? 'Vertalen...' : deContent ? '→ DE opnieuw' : '→ DE vertalen'}
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => translateContent('en')} disabled={translating === 'en'}>
                                {translating === 'en' ? 'Vertalen...' : enContent ? '→ EN opnieuw' : '→ EN vertalen'}
                              </button>
                            </>
                          )}
                          {lang !== 'nl' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => translateContent(lang)} disabled={translating === lang}>
                              {translating === lang ? 'Vertalen...' : 'Opnieuw vertalen'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <div>
                      <p style={{ color: '#9ca3af', marginBottom: 12, fontSize: 13 }}>
                        {lang === 'nl' ? 'Nog geen Nederlandse content.' : nlContent ? 'Nog niet vertaald.' : 'Genereer eerst NL content.'}
                      </p>
                      {lang === 'nl' && (
                        <button className="btn btn-success btn-sm" onClick={() => generateContent(getProductType(design))} disabled={generating}>
                          {generating ? 'Genereren...' : 'NL Content genereren (AI)'}
                        </button>
                      )}
                      {lang !== 'nl' && nlContent && (
                        <button className="btn btn-secondary btn-sm" onClick={() => translateContent(lang)} disabled={translating === lang}>
                          {translating === lang ? 'Vertalen...' : `Vertalen → ${lang.toUpperCase()}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ VARIANTEN */}
        {activeTab === 'variants' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Varianten ({design.variants.length})</h2>
              <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={generateVariants} disabled={generating}>
                {generating ? 'Aanmaken...' : design.variants.length > 0 ? 'Opnieuw aanmaken' : 'Varianten aanmaken'}
              </button>
            </div>
            {design.variants.length > 0 ? (() => {
              // Helpers for metafield display
              const materialPlainMap: Record<string, string> = { IB: 'Vinyl', SP: 'Aluminium-Dibond' }
              const spMaterialLabels: Record<string, string> = { GLAS: 'Gehard Glas', BRUSHED: 'Brushed Aluminium', ALU: 'Aluminium-Dibond' }
              const mcMaterialLabels: Record<string, string> = { ADI: 'Aluminium Dibond', FRX: 'Forex' }
              const getVariantMaterialFeed = (v: Variant): string => {
                if (v.productType === 'SP' && v.material) return spMaterialLabels[v.material] ?? v.material
                if (v.productType === 'MC' && v.material) return mcMaterialLabels[v.material] ?? v.material
                return materialPlainMap[v.productType] ?? '—'
              }
              const getWidthCm = (v: Variant): string => {
                if (v.productType === 'MC') return (Math.round(Number(v.size)) / 10).toFixed(1)
                const w = Number(v.size.split('x')[0])
                return (Math.round(w) / 10).toFixed(1)
              }
              const getHeightCm = (v: Variant): string => {
                if (v.productType === 'MC') return (Math.round(Number(v.size)) / 10).toFixed(1)
                const h = Number(v.size.split('x')[1])
                return (Math.round(h) / 10).toFixed(1)
              }
              return (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                      {['Type', 'Maat (mm)', 'SKU', 'EAN', 'Prijs', 'Shopify ID'].map((h) => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{h}</th>
                      ))}
                      <th colSpan={4} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280', borderLeft: '2px solid #e5e7eb', fontSize: 11 }}>
                        Shopify Metafields (variant)
                      </th>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                      {['', '', '', '', '', ''].map((_, i) => (
                        <th key={i} style={{ padding: '0 12px 6px' }} />
                      ))}
                      {[
                        { key: 'materiaal', label: 'materiaal' },
                        { key: 'breedte', label: 'breedte (cm)' },
                        { key: 'hoogte', label: 'hoogte (cm)' },
                        { key: 'mpn', label: 'mpn' },
                      ].map(({ key, label }) => (
                        <th key={key} style={{ textAlign: 'left', padding: '0 12px 6px', fontWeight: 500, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderLeft: key === 'materiaal' ? '2px solid #e5e7eb' : undefined }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {design.variants.map((v, i) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '7px 12px' }}><span className="badge badge-draft" style={{ fontSize: 10 }}>{v.productType}</span></td>
                        <td style={{ padding: '7px 12px', fontWeight: 500 }}>{v.size}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#374151' }}>{v.sku}</td>
                        <td style={{ padding: '7px 12px', color: '#6b7280' }}>{v.ean || '—'}</td>
                        <td style={{ padding: '7px 12px', fontWeight: 500 }}>{v.price != null ? `€${v.price.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 10, color: v.shopifyProductId ? '#16a34a' : '#9ca3af' }}>
                          {v.shopifyProductId || '—'}
                        </td>
                        <td style={{ padding: '7px 12px', color: '#374151', borderLeft: '2px solid #e5e7eb' }}>{getVariantMaterialFeed(v)}</td>
                        <td style={{ padding: '7px 12px', color: '#374151' }}>{getWidthCm(v)}</td>
                        <td style={{ padding: '7px 12px', color: '#374151' }}>{getHeightCm(v)}</td>
                        <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#6b7280', fontSize: 11 }}>{v.sku}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )
            })() : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
                <p style={{ marginBottom: 12 }}>Nog geen varianten aangemaakt.</p>
                <button className="btn btn-primary" onClick={generateVariants} disabled={generating}>
                  {generating ? 'Aanmaken...' : 'Varianten aanmaken'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Small reusable sub-components ───────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
      {children}
    </p>
  )
}

function DisabledHint({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 16 }}>⚠</span>
      {children}
    </div>
  )
}

function ProgressBar({ current, total, label }: { current: number; total: number; label: string }) {
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

function ActionRow({
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
            {statusOk ? '✓ ' : ''}{status}
          </div>
        )}
        {hint && !status && (
          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>⚠ {hint}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function ContentField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#374151' }}>{value}</p>
    </div>
  )
}

function MockupCard({
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
              <span style={{ color: '#fff', fontSize: 26 }}>⤢</span>
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
                ↗ Drive
              </a>
              <button
                onClick={onRegenerate}
                disabled={!canRegenerate || isRegenerating}
                className="btn btn-secondary"
                style={{ fontSize: 11, padding: '3px 8px' }}
                title="Opnieuw genereren"
              >
                {isRegenerating ? '...' : '↺'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
