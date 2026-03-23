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

  useEffect(() => {
    fetchDesign()
  }, [params.id])

  const generateVariants = async () => {
    if (!design) return
    
    setGenerating(true)
    try {
      const res = await fetch(`/api/designs/${params.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (data.success) {
        fetchDesign()
      }
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
        body: JSON.stringify({ designId: design.id, productType })
      })
      const data = await res.json()
      if (data.success) {
        fetchDesign()
      } else {
        alert('Content generation failed')
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
        body: JSON.stringify({ language })
      })
      const data = await res.json()
      if (data.success) {
        fetchDesign()
      }
    } catch (error) {
      console.error('Error translating content:', error)
    } finally {
      setTranslating(null)
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

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!design) {
    return <div className="container">Design not found</div>
  }

  const nlContent = design.content.find(c => c.language === 'nl')
  const deContent = design.content.find(c => c.language === 'de')
  const enContent = design.content.find(c => c.language === 'en')

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
          </div>
          <span className={`badge ${getStatusBadgeClass(design.status)}`} style={{ fontSize: 16, padding: '8px 16px' }}>
            {design.status}
          </span>
        </div>
      </header>

      <div className="grid grid-3" style={{ marginBottom: 30 }}>
        <div className="card">
          <h2>Product Types</h2>
          <div style={{ display: 'flex', gap: 10 }}>
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
              {generating ? 'Creating...' : 'Create Variants'}
            </button>
            <button 
              className="btn btn-success" 
              onClick={() => generateContent('INDUCTION')}
              disabled={generating}
            >
              Generate NL Content (AI)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 30 }}>
        <div className="card">
          <h2>Variants ({design.variants.length})</h2>
          {design.variants.length > 0 ? (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>Size</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>SKU</th>
                    <th style={{ textAlign: 'left', padding: 8 }}>EAN</th>
                  </tr>
                </thead>
                <tbody>
                  {design.variants.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                      <td style={{ padding: 8 }}>{v.productType}</td>
                      <td style={{ padding: 8 }}>{v.size}</td>
                      <td style={{ padding: 8 }}>{v.sku}</td>
                      <td style={{ padding: 8 }}>{v.ean || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: '#666' }}>No variants created yet</p>
          )}
        </div>
        
        <div className="card">
          <h2>Content</h2>
          
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Nederlands</h3>
            {nlContent ? (
              <div style={{ fontSize: 13 }}>
                <p><strong>Alt Text:</strong> {nlContent.altText}</p>
                <p><strong>SEO Title:</strong> {nlContent.seoTitle}</p>
                <p><strong>SEO Description:</strong> {nlContent.seoDescription}</p>
                <details>
                  <summary style={{ cursor: 'pointer', color: '#2563eb' }}>Description</summary>
                  <p style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{nlContent.description}</p>
                </details>
              </div>
            ) : (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => generateContent('INDUCTION')}
                disabled={generating}
              >
                Generate Content
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => translateContent('de')}
              disabled={translating === 'de' || !nlContent}
            >
              {translating === 'de' ? 'Translating...' : 'Translate to DE'}
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => translateContent('en')}
              disabled={translating === 'en' || !nlContent}
            >
              {translating === 'en' ? 'Translating...' : 'Translate to EN'}
            </button>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => translateContent('fr')}
              disabled={translating === 'fr' || !nlContent}
            >
              {translating === 'fr' ? 'Translating...' : 'Translate to FR'}
            </button>
          </div>
          
          {deContent && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 14, marginBottom: 10 }}>Deutsch</h3>
              <p style={{ fontSize: 13 }}><strong>SEO Title:</strong> {deContent.seoTitle}</p>
              <p style={{ fontSize: 13 }}><strong>SEO Description:</strong> {deContent.seoDescription}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
