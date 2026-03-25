'use client'

import { useEffect, useState, useCallback } from 'react'
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
  altText: string | null
  seoTitle: string | null
  seoDescription: string | null
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

export default function DesignDetail() {
  const params = useParams()
  const router = useRouter()
  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [translating, setTranslating] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState<{ shopifyProductId?: string; handle?: string; error?: string } | null>(null)
  const [forking, setForking] = useState(false)
  const shopifyConfigured = process.env.NEXT_PUBLIC_SHOPIFY_CONFIGURED === 'true'
  const [generatingMockups, setGeneratingMockups] = useState(false)
  const [deletingMockups, setDeletingMockups] = useState(false)
  const [regeneratingMockup, setRegeneratingMockup] = useState<string | null>(null) // templateId being regenerated
  const [mockupProgress, setMockupProgress] = useState<{ current: number; total: number } | null>(null)
  const [newMockupResults, setNewMockupResults] = useState<MockupGenerateResult[] | null>(null)
  const [mockupStatus, setMockupStatus] = useState<{ readyCount: number; totalCount: number; templates: { id: string; file: string; ready: boolean }[] } | null>(null)
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

  // Content inline editing state
  type ContentEditFields = { description: string; altText: string; seoTitle: string; seoDescription: string }
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

  useEffect(() => {
    fetchDesign()
  }, [fetchDesign])

  const fetchMockupStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`)
      const data = await res.json()
      setMockupStatus(data)
    } catch {}
  }, [params.id])

  useEffect(() => {
    if (design?.variants && design.variants.length > 0) {
      fetchMockupStatus()
    }
  }, [design?.variants?.length, fetchMockupStatus])

  const generateVariants = async () => {
    if (!design) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/designs/${params.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) fetchDesign()
    } catch (error) {
      console.error('Error generating variants:', error)
    } finally {
      setGenerating(false)
    }
  }

  const generateContent = async (productType: string) => {
    if (!design) return
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId: design.id, productType }),
      })
      const data = await res.json()
      if (data.success) {
        fetchDesign()
      } else {
        alert('Content generatie mislukt: ' + (data.error || 'onbekende fout'))
      }
    } catch (error) {
      console.error('Error generating content:', error)
      alert('Content generatie fout')
    } finally {
      setGenerating(false)
    }
  }

  const translateContent = async (language: string) => {
    if (!design) return
    setTranslating(language)
    try {
      const res = await fetch(`/api/designs/${params.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language }),
      })
      const data = await res.json()
      if (data.success) fetchDesign()
    } catch (error) {
      console.error('Error translating content:', error)
    } finally {
      setTranslating(null)
    }
  }

  const forkDesign = async (targetType: 'IB' | 'SP' | 'MC') => {
    if (!design) return
    if (!confirm(`Nieuw ${targetType}-product aanmaken op basis van "${design.designName}"?`)) return
    setForking(true)
    try {
      const res = await fetch(`/api/designs/${params.id}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType }),
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/designs/${data.design.id}`)
      } else if (data.existingId) {
        if (confirm(`Er bestaat al een ${targetType}-design. Wil je daarheen navigeren?`)) {
          router.push(`/designs/${data.existingId}`)
        }
      } else {
        alert('Fork mislukt: ' + (data.error || 'onbekende fout'))
      }
    } catch {
      alert('Fork fout')
    } finally {
      setForking(false)
    }
  }

  const publishToShopify = async () => {
    if (!design) return
    if (!confirm(`"${design.designName}" publiceren naar Shopify als conceptproduct?`)) return
    setPublishing(true)
    setPublishResult(null)
    try {
      const res = await fetch(`/api/designs/${params.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) {
        setPublishResult({ shopifyProductId: data.shopifyProductId, handle: data.shopifyProductHandle })
        fetchDesign()
      } else {
        setPublishResult({ error: data.error || 'Publish mislukt' })
      }
    } catch {
      setPublishResult({ error: 'Netwerkfout tijdens publiceren' })
    } finally {
      setPublishing(false)
    }
  }

  const generateMockups = async () => {
    if (!design) return
    setGeneratingMockups(true)
    setNewMockupResults(null)
    const total = mockupStatus?.totalCount ?? 0
    setMockupProgress({ current: 0, total })
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.results) {
        setNewMockupResults(data.results)
        setMockupProgress({ current: data.results.length, total: data.results.length })
        fetchDesign()
      } else {
        alert('Mockup generatie mislukt: ' + (data.error || 'onbekende fout'))
      }
    } catch {
      alert('Fout bij mockup generatie')
    } finally {
      setGeneratingMockups(false)
    }
  }

  const regenerateMockup = async (templateId: string) => {
    if (!design) return
    setRegeneratingMockup(templateId)
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      })
      const data = await res.json()
      if (data.results) {
        fetchDesign()
      } else {
        alert('Hergenerate mislukt: ' + (data.error || 'onbekende fout'))
      }
    } catch {
      alert('Fout bij hergenerate mockup')
    } finally {
      setRegeneratingMockup(null)
    }
  }

  const deleteAllMockups = async () => {
    if (!design) return
    if (!confirm('Alle mockups verwijderen? Je kunt ze daarna opnieuw genereren.')) return
    setDeletingMockups(true)
    setNewMockupResults(null)
    try {
      const res = await fetch(`/api/designs/${params.id}/mockup`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchDesign()
      } else {
        alert('Verwijderen mislukt: ' + (data.error || 'onbekende fout'))
      }
    } catch {
      alert('Fout bij verwijderen mockups')
    } finally {
      setDeletingMockups(false)
    }
  }

  const generateSizeSpecificMockups = async () => { /* legacy — not used */ }

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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          collections: JSON.stringify(collectionsArr),
          colorTags: JSON.stringify(colorTagsArr),
        }),
      })
      const data = await res.json()
      if (data.design) {
        setDesign((prev) => prev ? { ...prev, ...data.design } : data.design)
        setEditMode(false)
      }
    } catch (err) {
      alert('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const openContentEdit = (lang: string, c: Content) => {
    setContentEditValues((prev) => ({
      ...prev,
      [lang]: {
        description: c.description ?? '',
        altText: c.altText ?? '',
        seoTitle: c.seoTitle ?? '',
        seoDescription: c.seoDescription ?? '',
      },
    }))
    setContentEditMode((prev) => ({ ...prev, [lang]: true }))
  }

  const cancelContentEdit = (lang: string) => {
    setContentEditMode((prev) => ({ ...prev, [lang]: false }))
  }

  const saveContentEdit = async (lang: string) => {
    const values = contentEditValues[lang]
    if (!values) return
    setContentSaving((prev) => ({ ...prev, [lang]: true }))
    try {
      const res = await fetch(`/api/designs/${params.id}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: lang,
          description: values.description,
          altText: values.altText,
          seoTitle: values.seoTitle,
          seoDescription: values.seoDescription,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setContentEditMode((prev) => ({ ...prev, [lang]: false }))
        fetchDesign()
      } else {
        alert('Opslaan mislukt: ' + (data.error ?? 'onbekende fout'))
      }
    } catch {
      alert('Netwerkfout bij opslaan')
    } finally {
      setContentSaving((prev) => ({ ...prev, [lang]: false }))
    }
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

  // Derive product type from design flags
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
  const canPublish = !!(
    shopifyConfigured &&
    nlContent &&
    design.variants.length > 0 &&
    !alreadyOnShopify &&
    design.status !== 'LIVE'
  )

  // Combine saved DB mockups with any freshly generated ones this session
  const savedMockups = design.mockups ?? []
  const displayMockups: (DesignMockup & { isNew?: boolean } | MockupGenerateResult & { isNew?: boolean })[] =
    newMockupResults
      ? newMockupResults.map((r) => ({ ...r, isNew: true }))
      : savedMockups.map((m) => ({ ...m, isNew: false }))

  return (
    <div className="container">
      <header style={{ marginBottom: 30 }}>
        <button onClick={() => router.push('/')} className="btn btn-secondary" style={{ marginBottom: 10 }}>
          ← Terug naar Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {design.driveFileId && (
              <img
                src={`/api/drive-image/${design.driveFileId}`}
                alt={design.designName}
                style={{
                  width: 100,
                  height: 100,
                  objectFit: 'contain',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                }}
              />
            )}
            <div>
              <h1 style={{ margin: 0 }}>{design.designName}</h1>
              <p style={{ color: '#666', margin: '4px 0 0' }}>Code: <strong>{design.designCode}</strong></p>
              {design.designType && (
                <p style={{ color: '#666', margin: '2px 0 0', fontSize: 13 }}>Type: {design.designType}</p>
              )}
              {design.notionId && (
                <p style={{ color: '#999', fontSize: 12, margin: '2px 0 0' }}>Notion ID: {design.notionId}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-secondary" onClick={openEditMode} style={{ fontSize: 13 }}>
              Bewerken
            </button>
            <span className={`badge ${getStatusBadgeClass(design.status)}`} style={{ fontSize: 16, padding: '8px 16px', whiteSpace: 'nowrap' }}>
              {design.status}
            </span>
          </div>
        </div>
      </header>

      {/* Edit modal */}
      {editMode && editForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
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
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
              <button className="btn btn-secondary" onClick={() => setEditMode(false)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Publish banner */}
      {publishResult && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${publishResult.error ? '#ef4444' : '#22c55e'}`,
            background: publishResult.error ? '#fef2f2' : '#f0fdf4',
          }}
        >
          {publishResult.error ? (
            <p style={{ color: '#dc2626' }}>Publiceren mislukt: {publishResult.error}</p>
          ) : (
            <p style={{ color: '#16a34a' }}>
              Gepubliceerd naar Shopify! Product ID: <strong>{publishResult.shopifyProductId}</strong>
              {publishResult.handle && <> — Handle: <strong>{publishResult.handle}</strong></>}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 30 }}>
        <div className="card">
          <h2>Producttypes</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className={design.inductionFriendly ? 'badge badge-approved' : 'badge badge-draft'}>Inductiebeschermer</span>
            <span className={design.circleFriendly ? 'badge badge-approved' : 'badge badge-draft'}>Muurcirkel</span>
            <span className={design.splashFriendly ? 'badge badge-approved' : 'badge badge-draft'}>Spatscherm</span>
          </div>
        </div>

        <div className="card">
          <h2>Collecties</h2>
          <p>{design.collections ? JSON.parse(design.collections).join(', ') : 'Geen'}</p>
        </div>

        <div className="card">
          <h2>Kleuren</h2>
          <p>{design.colorTags ? JSON.parse(design.colorTags).join(', ') : 'Geen'}</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 30 }}>
        <div className="card">
          <h2>Workflowstappen</h2>
          <div className="workflow-steps">
            {design.workflowSteps.map((step) => (
              <span key={step.id} className={`step ${getStepStatusClass(step.status)}`}>
                {step.step.replace(/_/g, ' ')}
              </span>
            ))}
            {design.workflowSteps.length === 0 && (
              <p style={{ color: '#666', fontSize: 13 }}>Nog geen workflowstappen</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Acties</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary" onClick={generateVariants} disabled={generating}>
              {generating ? 'Aanmaken...' : `Varianten aanmaken (${design.variants.length} bestaand)`}
            </button>

            {!nlContent ? (
              <button className="btn btn-success" onClick={() => generateContent(getProductType(design))} disabled={generating}>
                {generating ? 'Genereren...' : 'NL Content genereren (AI)'}
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={() => generateContent(getProductType(design))} disabled={generating}>
                {generating ? 'Genereren...' : 'NL Content opnieuw genereren'}
              </button>
            )}

            {/* Mockups genereren */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 4 }}>
              {mockupStatus && (
                <p style={{ fontSize: 12, color: mockupStatus.readyCount === 0 ? '#f59e0b' : '#16a34a', marginBottom: 6 }}>
                  PSD templates gereed: {mockupStatus.readyCount}/{mockupStatus.totalCount}
                </p>
              )}
              {generatingMockups && mockupProgress && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    Photoshop werkt... (kan enkele minuten duren)
                  </div>
                  <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{
                      background: '#2563eb',
                      height: '100%',
                      width: mockupProgress.total > 0
                        ? `${Math.round((mockupProgress.current / mockupProgress.total) * 100)}%`
                        : '100%',
                      transition: 'width 0.3s',
                      animation: 'pulse 1.5s ease-in-out infinite',
                    }} />
                  </div>
                </div>
              )}
              <button
                className="btn btn-secondary"
                onClick={generateMockups}
                disabled={generatingMockups || design.variants.length === 0}
                title={design.variants.length === 0 ? 'Maak eerst varianten aan' : 'Genereer alle mockups (generiek + maat-specifiek)'}
              >
                {generatingMockups
                  ? 'Mockups genereren...'
                  : savedMockups.length > 0
                    ? `Alle mockups opnieuw genereren (${savedMockups.length} opgeslagen)`
                    : 'Alle mockups genereren'}
              </button>
            </div>

            {/* Publiceren naar Shopify */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 4 }}>
              {alreadyOnShopify ? (
                <p style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>
                  Op Shopify — ID: {shopifyVariantId}
                </p>
              ) : !shopifyConfigured ? (
                <p style={{ fontSize: 12, color: '#9ca3af' }}>
                  Shopify niet geconfigureerd
                </p>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={publishToShopify}
                  disabled={publishing || !canPublish}
                  title={
                    !nlContent ? 'NL content is eerst vereist'
                    : design.variants.length === 0 ? 'Varianten zijn eerst vereist'
                    : 'Publiceer naar Shopify als concept'
                  }
                  style={{ background: canPublish ? '#7c3aed' : undefined }}
                >
                  {publishing ? 'Publiceren...' : 'Publiceren naar Shopify'}
                </button>
              )}
            </div>

            {/* Fork naar ander producttype */}
            {(() => {
              const otherTypes: { type: 'IB' | 'SP' | 'MC'; label: string; enabled: boolean }[] = (
                [
                  { type: 'IB' as const, label: 'Inductiebeschermer', enabled: !design.inductionFriendly },
                  { type: 'SP' as const, label: 'Spatscherm', enabled: !design.splashFriendly },
                  { type: 'MC' as const, label: 'Muurcirkel', enabled: !design.circleFriendly },
                ] as const
              ).filter((t) => t.enabled)
              if (otherTypes.length === 0) return null
              return (
                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Maak variant voor ander producttype:</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {otherTypes.map(({ type, label }) => (
                      <button
                        key={type}
                        className="btn btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => forkDesign(type)}
                        disabled={forking}
                        title={`Nieuw ${label}-product aanmaken met hetzelfde design`}
                      >
                        {forking ? '...' : `+ ${type} aanmaken`}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Mockups sectie */}
      {(displayMockups.length > 0 || generatingMockups || savedMockups.length > 0) && (
        <div className="card" style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>
              Mockups
              {savedMockups.length > 0 && !newMockupResults && (
                <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>
                  ({savedMockups.length} opgeslagen)
                </span>
              )}
              {newMockupResults && (
                <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 400, marginLeft: 8 }}>
                  {newMockupResults.filter((r) => !r.skipped).length} gegenereerd
                </span>
              )}
            </h2>
            {savedMockups.length > 0 && !generatingMockups && (
              <button
                className="btn btn-danger"
                style={{ fontSize: 12 }}
                onClick={deleteAllMockups}
                disabled={deletingMockups}
                title="Verwijder alle mockups uit de database zodat je opnieuw kunt beginnen"
              >
                {deletingMockups ? 'Verwijderen...' : 'Alle mockups verwijderen'}
              </button>
            )}
          </div>

          {generatingMockups ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#6b7280' }}>
              <p>Photoshop genereert mockups... Dit kan 10-20 minuten duren (alle templates).</p>
            </div>
          ) : displayMockups.length === 0 ? (
            <p style={{ color: '#6b7280' }}>Geen mockups gegenereerd.</p>
          ) : (
            <>
              {/* Generieke mockups */}
              {(() => {
                const genericMockups = displayMockups.filter((r) => !(r as DesignMockup).sizeKey)
                if (genericMockups.length === 0) return null
                return (
                  <div style={{ marginBottom: 24 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                      Generieke mockups
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                      {genericMockups.map((r) => {
                        const fileId = (r as DesignMockup).driveFileId || r.driveUrl.match(/[?&]id=([^&]+)/)?.[1] || r.driveUrl.match(/\/d\/([^/]+)\//)?.[1]
                        const viewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : r.driveUrl
                        const displayName = (r as MockupGenerateResult).label || (r as DesignMockup).outputName || r.outputName
                        const isRegenerating = regeneratingMockup === r.templateId
                        return (
                          <div key={r.templateId} style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: 8,
                            padding: 10,
                            minWidth: 170,
                            maxWidth: 200,
                            background: (r as MockupGenerateResult & { isNew?: boolean }).isNew ? '#f0fdf4' : '#fff',
                          }}>
                            <p style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#374151' }}>{displayName}</p>
                            {r.skipped ? (
                              <p style={{ fontSize: 11, color: '#f59e0b' }}>Overgeslagen: {r.skipReason}</p>
                            ) : (
                              <>
                                <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                                  <img
                                     src={fileId ? `/api/drive-image/${fileId}` : r.driveUrl}
                                    alt={(r as DesignMockup).altText || displayName}
                                    style={{ width: '100%', borderRadius: 4, objectFit: 'cover', maxHeight: 140 }}
                                    onError={(e) => {
                                      const img = e.target as HTMLImageElement
                                      if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = r.driveUrl }
                                    }}
                                  />
                                </a>
                                {(r as DesignMockup).altText && (
                                  <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, fontStyle: 'italic' }} title="Alt-tekst voor Shopify">
                                    {(r as DesignMockup).altText}
                                  </p>
                                )}
                                <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                                  <a href={viewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#2563eb' }}>Openen</a>
                                  <button
                                    onClick={() => regenerateMockup(r.templateId)}
                                    disabled={!!regeneratingMockup || generatingMockups}
                                    style={{ fontSize: 10, color: '#6b7280', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}
                                    title="Genereer deze mockup opnieuw"
                                  >
                                    {isRegenerating ? '...' : '↺'}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Size-specific mockups per variant */}
              {design.variants.length > 0 && (() => {
                // Use DB sizeKey field if available, else fallback to templateId heuristic
                const sizeSpecificMockups = displayMockups.filter((r) => !!(r as DesignMockup).sizeKey)
                if (sizeSpecificMockups.length === 0) return null
                return (
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                      Maat-specifieke mockups
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {design.variants.map((v) => {
                        const vSizeKey = v.size.replace(/\s*mm\s*/i, '').replace(/\s+/g, '')
                        const variantMockups = sizeSpecificMockups.filter(
                          (r) => (r as DesignMockup).sizeKey === vSizeKey
                        )
                        return (
                          <div key={v.id} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                                {v.productType} — {v.size}
                              </span>
                              <span style={{ fontSize: 11, color: '#9ca3af' }}>{v.sku}</span>
                            </div>
                            {variantMockups.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                {variantMockups.map((m) => {
                                  const fileId = (m as DesignMockup).driveFileId || ''
                                  const viewUrl = `https://drive.google.com/file/d/${fileId}/view`
                                  const displayName = (m as MockupGenerateResult).label || (m as DesignMockup).outputName || m.outputName
                                  const isRegenerating = regeneratingMockup === m.templateId
                                  return (
                                    <div key={m.templateId} style={{ width: 150 }}>
                                      <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{displayName}</p>
                                       <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                                         <img
                                           src={fileId ? `/api/drive-image/${fileId}` : ''}
                                           alt={(m as DesignMockup).altText || displayName}
                                           style={{ width: '100%', borderRadius: 4, objectFit: 'cover', maxHeight: 100 }}
                                         />
                                      </a>
                                      {(m as DesignMockup).altText && (
                                        <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, fontStyle: 'italic' }}>
                                          {(m as DesignMockup).altText}
                                        </p>
                                      )}
                                      <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                                        <a href={viewUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: '#2563eb' }}>Openen</a>
                                        <button
                                          onClick={() => regenerateMockup(m.templateId)}
                                          disabled={!!regeneratingMockup || generatingMockups}
                                          style={{ fontSize: 10, color: '#6b7280', background: 'none', border: '1px solid #d1d5db', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}
                                          title="Genereer deze mockup opnieuw"
                                        >
                                          {isRegenerating ? '...' : '↺'}
                                        </button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <p style={{ fontSize: 11, color: '#9ca3af' }}>Geen maat-specifieke mockup voor deze maat.</p>
                            )}
                          </div>
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


      {/* Template status — alleen tonen als templates ontbreken */}
      {mockupStatus && mockupStatus.readyCount < mockupStatus.totalCount && (
        <div className="card" style={{ marginBottom: 30, borderLeft: '4px solid #f59e0b', background: '#fffbeb' }}>
          <h2 style={{ color: '#92400e' }}>Ontbrekende PSD templates</h2>
          <ul style={{ fontSize: 12, color: '#78350f', margin: 0, paddingLeft: 20 }}>
            {mockupStatus.templates.filter((t: { ready: boolean; file?: string; id: string }) => !t.ready).map((t) => (
              <li key={t.id} style={{ marginBottom: 4 }}>
                <code>{t.file}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Content cards — NL, DE, EN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 30 }}>

        {/* NL Content */}
        {(() => {
          const lang = 'nl'
          const c = nlContent
          const editing = contentEditMode[lang]
          const vals = contentEditValues[lang]
          const isSaving = contentSaving[lang]
          return (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Content — Nederlands</h2>
                {c && !editing && (
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => openContentEdit(lang, c)}>
                    Bewerken
                  </button>
                )}
              </div>
              {c ? (
                editing && vals ? (
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Alt Text</label>
                      <input value={vals.altText} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], altText: e.target.value } }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>SEO Title</label>
                      <input value={vals.seoTitle} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], seoTitle: e.target.value } }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>SEO Description</label>
                      <textarea rows={2} value={vals.seoDescription} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], seoDescription: e.target.value } }))} style={{ resize: 'vertical' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Beschrijving</label>
                      <textarea rows={6} value={vals.description} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], description: e.target.value } }))} style={{ resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveContentEdit(lang)} disabled={isSaving}>{isSaving ? 'Opslaan...' : 'Opslaan'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => cancelContentEdit(lang)} disabled={isSaving}>Annuleren</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    <p><strong>Alt Text:</strong> {c.altText}</p>
                    <p style={{ marginTop: 8 }}><strong>SEO Title:</strong> {c.seoTitle}</p>
                    <p style={{ marginTop: 4 }}><strong>SEO Description:</strong> {c.seoDescription}</p>
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: 'pointer', color: '#2563eb' }}>Beschrijving</summary>
                      <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12 }}>{c.description}</p>
                    </details>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => generateContent(getProductType(design))} disabled={generating}>
                        {generating ? 'Genereren...' : 'Opnieuw genereren'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => translateContent('de')} disabled={translating === 'de'}>
                        {translating === 'de' ? 'Vertalen...' : deContent ? 'DE opnieuw' : 'Vertalen → DE'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => translateContent('en')} disabled={translating === 'en'}>
                        {translating === 'en' ? 'Vertalen...' : enContent ? 'EN opnieuw' : 'Vertalen → EN'}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <p style={{ color: '#666', marginBottom: 12 }}>Nog geen Nederlandse content.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => generateContent(getProductType(design))} disabled={generating}>
                    {generating ? 'Genereren...' : 'NL Content genereren (AI)'}
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* DE Content */}
        {(() => {
          const lang = 'de'
          const c = deContent
          const editing = contentEditMode[lang]
          const vals = contentEditValues[lang]
          const isSaving = contentSaving[lang]
          return (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Content — Deutsch</h2>
                {c && !editing && (
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => openContentEdit(lang, c)}>
                    Bearbeiten
                  </button>
                )}
              </div>
              {c ? (
                editing && vals ? (
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Alt Text</label>
                      <input value={vals.altText} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], altText: e.target.value } }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>SEO Title</label>
                      <input value={vals.seoTitle} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], seoTitle: e.target.value } }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>SEO Description</label>
                      <textarea rows={2} value={vals.seoDescription} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], seoDescription: e.target.value } }))} style={{ resize: 'vertical' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Beschreibung</label>
                      <textarea rows={6} value={vals.description} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], description: e.target.value } }))} style={{ resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveContentEdit(lang)} disabled={isSaving}>{isSaving ? 'Speichern...' : 'Opslaan'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => cancelContentEdit(lang)} disabled={isSaving}>Annuleren</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    <p><strong>Alt Text:</strong> {c.altText}</p>
                    <p style={{ marginTop: 8 }}><strong>SEO Title:</strong> {c.seoTitle}</p>
                    <p style={{ marginTop: 4 }}><strong>SEO Description:</strong> {c.seoDescription}</p>
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: 'pointer', color: '#2563eb' }}>Beschreibung</summary>
                      <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12 }}>{c.description}</p>
                    </details>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>Status: {c.translationStatus}</p>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => translateContent('de')} disabled={translating === 'de'}>
                      {translating === 'de' ? 'Vertalen...' : 'Opnieuw vertalen'}
                    </button>
                  </div>
                )
              ) : (
                <div>
                  <p style={{ color: '#666', marginBottom: 12 }}>
                    {nlContent ? 'Nog niet vertaald.' : 'Genereer eerst NL content.'}
                  </p>
                  {nlContent && (
                    <button className="btn btn-secondary btn-sm" onClick={() => translateContent('de')} disabled={translating === 'de'}>
                      {translating === 'de' ? 'Vertalen...' : 'Vertalen naar DE'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* EN Content */}
        {(() => {
          const lang = 'en'
          const c = enContent
          const editing = contentEditMode[lang]
          const vals = contentEditValues[lang]
          const isSaving = contentSaving[lang]
          return (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Content — English</h2>
                {c && !editing && (
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => openContentEdit(lang, c)}>
                    Edit
                  </button>
                )}
              </div>
              {c ? (
                editing && vals ? (
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Alt Text</label>
                      <input value={vals.altText} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], altText: e.target.value } }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>SEO Title</label>
                      <input value={vals.seoTitle} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], seoTitle: e.target.value } }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>SEO Description</label>
                      <textarea rows={2} value={vals.seoDescription} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], seoDescription: e.target.value } }))} style={{ resize: 'vertical' }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 11 }}>Description</label>
                      <textarea rows={6} value={vals.description} onChange={(e) => setContentEditValues((p) => ({ ...p, [lang]: { ...p[lang], description: e.target.value } }))} style={{ resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => saveContentEdit(lang)} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => cancelContentEdit(lang)} disabled={isSaving}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    <p><strong>Alt Text:</strong> {c.altText}</p>
                    <p style={{ marginTop: 8 }}><strong>SEO Title:</strong> {c.seoTitle}</p>
                    <p style={{ marginTop: 4 }}><strong>SEO Description:</strong> {c.seoDescription}</p>
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: 'pointer', color: '#2563eb' }}>Description</summary>
                      <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12 }}>{c.description}</p>
                    </details>
                    <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>Status: {c.translationStatus}</p>
                    <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => translateContent('en')} disabled={translating === 'en'}>
                      {translating === 'en' ? 'Translating...' : 'Re-translate'}
                    </button>
                  </div>
                )
              ) : (
                <div>
                  <p style={{ color: '#666', marginBottom: 12 }}>
                    {nlContent ? 'Not yet translated.' : 'Generate NL content first.'}
                  </p>
                  {nlContent && (
                    <button className="btn btn-secondary btn-sm" onClick={() => translateContent('en')} disabled={translating === 'en'}>
                      {translating === 'en' ? 'Translating...' : 'Translate → EN'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Variants */}
      <div className="card" style={{ marginBottom: 30 }}>
        <h2>Varianten ({design.variants.length})</h2>
        {design.variants.length > 0 ? (
          <div style={{ maxHeight: 350, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Maat (mm)</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Materiaal</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>EAN</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Prijs</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Gewicht (g)</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Shopify ID</th>
                </tr>
              </thead>
              <tbody>
                {design.variants.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '6px 12px' }}>{v.productType}</td>
                    <td style={{ padding: '6px 12px' }}>{v.size}</td>
                    <td style={{ padding: '6px 12px' }}>{v.material ?? '—'}</td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{v.sku}</td>
                    <td style={{ padding: '6px 12px' }}>{v.ean || '—'}</td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                      {v.price != null ? `€${v.price.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '6px 12px', textAlign: 'right' }}>
                      {v.weight != null ? Math.round(v.weight * 1000) : '—'}
                    </td>
                    <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>
                      {v.shopifyProductId || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#666' }}>Nog geen varianten aangemaakt.</p>
        )}
      </div>
    </div>
  )
}
