'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

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
  variants: Variant[]
  content: Content[]
  workflowSteps: WorkflowStep[]
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
  const [shopifyPreview, setShopifyPreview] = useState<{ shopifyConfigured: boolean; payload?: unknown } | null>(null)

  const fetchDesign = async () => {
    try {
      const res = await fetch(`/api/designs/${params.id}`)
      const data = await res.json()
      setDesign(data.design)
    } catch (error) {
      console.error('Error fetching design:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchShopifyPreview = async () => {
    try {
      const res = await fetch(`/api/designs/${params.id}/publish`)
      const data = await res.json()
      setShopifyPreview(data)
    } catch (error) {
      console.error('Error fetching Shopify preview:', error)
    }
  }

  useEffect(() => {
    fetchDesign()
    fetchShopifyPreview()
  }, [params.id])

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
        alert('Content generation failed: ' + (data.error || 'unknown error'))
      }
    } catch (error) {
      console.error('Error generating content:', error)
      alert('Content generation error')
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

  const publishToShopify = async () => {
    if (!design) return
    if (!confirm(`Publish "${design.designName}" to Shopify as a draft product?`)) return
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
        setPublishResult({ error: data.error || 'Publish failed' })
      }
    } catch (error) {
      setPublishResult({ error: 'Network error during publish' })
    } finally {
      setPublishing(false)
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

  if (loading) return <div className="loading">Loading...</div>
  if (!design) return <div className="container">Design not found</div>

  const nlContent = design.content.find((c) => c.language === 'nl')
  const deContent = design.content.find((c) => c.language === 'de')
  const enContent = design.content.find((c) => c.language === 'en')

  const shopifyVariantId = design.variants.find((v) => v.shopifyProductId)?.shopifyProductId
  const alreadyOnShopify = !!shopifyVariantId
  const canPublish = !!(
    shopifyPreview?.shopifyConfigured &&
    nlContent &&
    design.variants.length > 0 &&
    !alreadyOnShopify &&
    design.status !== 'LIVE'
  )

  return (
    <div className="container">
      <header style={{ marginBottom: 30 }}>
        <button onClick={() => router.push('/')} className="btn btn-secondary" style={{ marginBottom: 10 }}>
          ← Back to Dashboard
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>{design.designName}</h1>
            <p style={{ color: '#666' }}>Code: {design.designCode}</p>
            {design.notionId && (
              <p style={{ color: '#999', fontSize: 12 }}>Notion ID: {design.notionId}</p>
            )}
          </div>
          <span className={`badge ${getStatusBadgeClass(design.status)}`} style={{ fontSize: 16, padding: '8px 16px' }}>
            {design.status}
          </span>
        </div>
      </header>

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
            <p style={{ color: '#dc2626' }}>Publish failed: {publishResult.error}</p>
          ) : (
            <p style={{ color: '#16a34a' }}>
              Published to Shopify! Product ID: <strong>{publishResult.shopifyProductId}</strong>
              {publishResult.handle && <> — Handle: <strong>{publishResult.handle}</strong></>}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-3" style={{ marginBottom: 30 }}>
        <div className="card">
          <h2>Product Types</h2>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className={design.inductionFriendly ? 'badge badge-approved' : 'badge badge-draft'}>
              Inductiebeschermer
            </span>
            <span className={design.circleFriendly ? 'badge badge-approved' : 'badge badge-draft'}>
              Muurcirkel
            </span>
            <span className={design.splashFriendly ? 'badge badge-approved' : 'badge badge-draft'}>
              Spatscherm
            </span>
          </div>
        </div>

        <div className="card">
          <h2>Collections</h2>
          <p>{design.collections ? JSON.parse(design.collections).join(', ') : 'None'}</p>
        </div>

        <div className="card">
          <h2>Colors</h2>
          <p>{design.colorTags ? JSON.parse(design.colorTags).join(', ') : 'None'}</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 30 }}>
        <div className="card">
          <h2>Workflow Steps</h2>
          <div className="workflow-steps">
            {design.workflowSteps.map((step) => (
              <span key={step.id} className={`step ${getStepStatusClass(step.status)}`}>
                {step.step.replace(/_/g, ' ')}
              </span>
            ))}
            {design.workflowSteps.length === 0 && (
              <p style={{ color: '#666', fontSize: 13 }}>No workflow steps yet</p>
            )}
          </div>
        </div>

        <div className="card">
          <h2>Actions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={generateVariants}
              disabled={generating}
            >
              {generating ? 'Creating...' : `Create Variants (${design.variants.length} existing)`}
            </button>
            <button
              className="btn btn-success"
              onClick={() => generateContent('INDUCTION')}
              disabled={generating || !!nlContent}
              title={nlContent ? 'NL content already exists' : 'Generate NL content with AI'}
            >
              {generating ? 'Generating...' : nlContent ? 'NL Content ✓' : 'Generate NL Content (AI)'}
            </button>
            {nlContent && !deContent && (
              <button
                className="btn btn-secondary"
                onClick={() => translateContent('de')}
                disabled={translating === 'de'}
              >
                {translating === 'de' ? 'Translating...' : 'Translate to DE'}
              </button>
            )}

            {/* Publish to Shopify */}
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 4 }}>
              {alreadyOnShopify ? (
                <div>
                  <p style={{ fontSize: 13, color: '#16a34a', marginBottom: 6 }}>
                    On Shopify — ID: {shopifyVariantId}
                  </p>
                </div>
              ) : !shopifyPreview?.shopifyConfigured ? (
                <p style={{ fontSize: 12, color: '#9ca3af' }}>
                  Shopify not configured (add SHOPIFY_ACCESS_TOKEN)
                </p>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={publishToShopify}
                  disabled={publishing || !canPublish}
                  title={
                    !nlContent
                      ? 'NL content required first'
                      : design.variants.length === 0
                      ? 'Variants required first'
                      : 'Publish to Shopify as draft'
                  }
                  style={{ background: canPublish ? '#7c3aed' : undefined }}
                >
                  {publishing ? 'Publishing...' : 'Publish to Shopify'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content cards */}
      <div className="grid grid-2" style={{ marginBottom: 30 }}>
        {/* NL Content */}
        <div className="card">
          <h2>Content — Nederlands</h2>
          {nlContent ? (
            <div style={{ fontSize: 13 }}>
              <p><strong>Alt Text:</strong> {nlContent.altText}</p>
              <p style={{ marginTop: 8 }}><strong>SEO Title:</strong> {nlContent.seoTitle}</p>
              <p style={{ marginTop: 4 }}><strong>SEO Description:</strong> {nlContent.seoDescription}</p>
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', color: '#2563eb' }}>Beschrijving</summary>
                <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12 }}>{nlContent.description}</p>
              </details>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => translateContent('de')}
                  disabled={translating === 'de'}
                >
                  {translating === 'de' ? 'Translating...' : deContent ? 'Re-translate DE' : 'Translate to DE'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => translateContent('en')}
                  disabled={translating === 'en'}
                >
                  {translating === 'en' ? 'Translating...' : enContent ? 'Re-translate EN' : 'Translate to EN'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ color: '#666', marginBottom: 12 }}>No Dutch content yet.</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => generateContent('INDUCTION')}
                disabled={generating}
              >
                Generate NL Content (AI)
              </button>
            </div>
          )}
        </div>

        {/* DE Content */}
        <div className="card">
          <h2>Content — Deutsch</h2>
          {deContent ? (
            <div style={{ fontSize: 13 }}>
              <p><strong>Alt Text:</strong> {deContent.altText}</p>
              <p style={{ marginTop: 8 }}><strong>SEO Title:</strong> {deContent.seoTitle}</p>
              <p style={{ marginTop: 4 }}><strong>SEO Description:</strong> {deContent.seoDescription}</p>
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', color: '#2563eb' }}>Beschreibung</summary>
                <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12 }}>{deContent.description}</p>
              </details>
              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 10 }}>
                Status: {deContent.translationStatus}
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: '#666', marginBottom: 12 }}>
                {nlContent ? 'Not yet translated.' : 'Generate NL content first.'}
              </p>
              {nlContent && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => translateContent('de')}
                  disabled={translating === 'de'}
                >
                  {translating === 'de' ? 'Translating...' : 'Translate to DE'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Variants */}
      <div className="card" style={{ marginBottom: 30 }}>
        <h2>Variants ({design.variants.length})</h2>
        {design.variants.length > 0 ? (
          <div style={{ maxHeight: 350, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Size (mm)</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>EAN</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '8px 12px' }}>Weight (g)</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px' }}>Shopify ID</th>
                </tr>
              </thead>
              <tbody>
                {design.variants.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '6px 12px' }}>{v.productType}</td>
                    <td style={{ padding: '6px 12px' }}>{v.size}</td>
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
          <p style={{ color: '#666' }}>No variants created yet.</p>
        )}
      </div>
    </div>
  )
}
