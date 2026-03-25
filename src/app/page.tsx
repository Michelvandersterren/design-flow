'use client'

import { useEffect, useState, useCallback } from 'react'

interface Design {
  id: string
  designCode: string
  designName: string
  status: string
  inductionFriendly: boolean
  circleFriendly: boolean
  splashFriendly: boolean
  collections: string | null
  variants: { id: string; productType: string }[]
  content: { language: string; translationStatus: string }[]
  workflowSteps: { id: string; step: string; status: string }[]
  updatedAt: string
}

interface BulkPublishStepResult {
  designId: string
  designCode: string
  designName: string
  status: 'ok' | 'skipped' | 'error'
  shopifyProductId?: string
  detail?: string
}

interface BulkPublishResult {
  summary: { total: number; succeeded: number; skipped: number; failed: number }
  results: BulkPublishStepResult[]
}

interface StyleFamilyResult {
  success: boolean
  total: number
  assigned: number
  notionErrors: number
  families: { family: string; count: number }[]
}

interface BulkStepResult {
  step: string
  status: 'ok' | 'skipped' | 'error'
  detail?: string
}

interface BulkDesignResult {
  designId: string
  designCode: string
  designName: string
  steps: BulkStepResult[]
  error?: string
}

interface BulkResult {
  summary: { total: number; succeeded: number; failed: number }
  results: BulkDesignResult[]
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  CONTENT_GENERATING: '#d97706',
  REVIEW: '#2563eb',
  APPROVED: '#16a34a',
  PUBLISHING: '#7c3aed',
  LIVE: '#15803d',
  ARCHIVED: '#9ca3af',
}

const STEP_ICON: Record<string, string> = {
  ok: '✓',
  skipped: '–',
  error: '✗',
}

export default function Dashboard() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [bulkPublishRunning, setBulkPublishRunning] = useState(false)
  const [bulkPublishResult, setBulkPublishResult] = useState<BulkPublishResult | null>(null)
  const [styleFamiliesRunning, setStyleFamiliesRunning] = useState(false)
  const [styleFamiliesResult, setStyleFamiliesResult] = useState<StyleFamilyResult | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchDesigns = useCallback(async () => {
    try {
      const res = await fetch('/api/designs')
      const data = await res.json()
      setDesigns(data.designs || [])
    } catch (err) {
      console.error('Error fetching designs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDesigns()
  }, [fetchDesigns])

  const syncFromNotion = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all' }),
      })
      const data = await res.json()
      if (data.success) {
        await fetchDesigns()
        alert(`Sync klaar: ${data.synced} designs bijgewerkt`)
      }
    } catch {
      alert('Sync mislukt')
    } finally {
      setSyncing(false)
    }
  }

  const runBulkWorkflow = async () => {
    const draftCount = designs.filter((d) => d.status === 'DRAFT').length
    if (draftCount === 0) {
      alert('Geen DRAFT designs om te verwerken.')
      return
    }
    if (!confirm(`Bulk workflow starten voor ${draftCount} DRAFT designs?\n\nDit genereert AI content (NL), vertaalt naar DE + EN en maakt varianten aan.`)) return

    setBulkRunning(true)
    setBulkResult(null)
    try {
      const res = await fetch('/api/workflow/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setBulkResult(data)
      await fetchDesigns()
    } catch {
      alert('Bulk workflow mislukt')
    } finally {
      setBulkRunning(false)
    }
  }

  const runBulkPublish = async () => {
    const publishableCount = designs.filter((d) => d.status === 'APPROVED').length
    if (publishableCount === 0) {
      alert('Geen APPROVED designs om te publiceren.')
      return
    }
    if (!confirm(`${publishableCount} APPROVED designs publiceren naar Shopify (als draft)?\n\nDesigns zonder NL content worden overgeslagen.`)) return

    setBulkPublishRunning(true)
    setBulkPublishResult(null)
    try {
      const res = await fetch('/api/workflow/bulk-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      setBulkPublishResult(data)
      await fetchDesigns()
    } catch {
      alert('Bulk publiceren mislukt')
    } finally {
      setBulkPublishRunning(false)
    }
  }

  const runStyleFamilies = async (overwrite = false) => {
    const noFamilyCount = designs.filter((d) => !(d as any).styleFamily).length
    const confirmMsg = overwrite
      ? `Stijlfamilies opnieuw toewijzen voor ALLE ${designs.length} designs?\n\nBestaande stijlfamilies worden overschreven en teruggeschreven naar Notion.`
      : `Stijlfamilies automatisch toewijzen voor ${noFamilyCount} designs zonder familie?\n\nDesigns met al een stijlfamilie worden overgeslagen. Resultaat wordt teruggeschreven naar Notion.`
    if (!confirm(confirmMsg)) return

    setStyleFamiliesRunning(true)
    setStyleFamiliesResult(null)
    try {
      const res = await fetch('/api/designs/style-families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite, notionSync: true }),
      })
      const data = await res.json()
      setStyleFamiliesResult(data)
      await fetchDesigns()
    } catch {
      alert('Stijlfamilies genereren mislukt')
    } finally {
      setStyleFamiliesRunning(false)
    }
  }

  const stats = {
    total: designs.length,
    draft: designs.filter((d) => d.status === 'DRAFT').length,
    review: designs.filter((d) => d.status === 'REVIEW').length,
    approved: designs.filter((d) => d.status === 'APPROVED').length,
    live: designs.filter((d) => d.status === 'LIVE').length,
  }

  const filteredDesigns = designs.filter((d) => {
    const matchSearch =
      !searchTerm ||
      d.designName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.designCode.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = !filterStatus || d.status === filterStatus
    return matchSearch && matchStatus
  })

  const getWorkflowBadges = (design: Design) => {
    const hasNl = design.content.some((c) => c.language === 'nl')
    const hasDe = design.content.some((c) => c.language === 'de')
    const hasEn = design.content.some((c) => c.language === 'en')
    const hasVariants = design.variants.length > 0
    return { hasNl, hasDe, hasEn, hasVariants }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
        Laden...
      </div>
    )
  }

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Design Flow</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            {stats.draft > 0 && (
              <button
                className="btn btn-success"
                onClick={runBulkWorkflow}
                disabled={bulkRunning}
                title="Genereer content, vertaal naar DE + EN en maak varianten voor alle DRAFT designs"
              >
                {bulkRunning ? 'Bezig...' : `Verwerk ${stats.draft} DRAFT designs`}
              </button>
            )}
            {stats.approved > 0 && (
              <button
                className="btn btn-success"
                onClick={runBulkPublish}
                disabled={bulkPublishRunning}
                title="Publiceer alle APPROVED designs naar Shopify als draft"
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
              >
                {bulkPublishRunning
                  ? 'Publiceren...'
                  : `Publiceer ${stats.approved} naar Shopify`}
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => runStyleFamilies(false)}
              disabled={styleFamiliesRunning}
              title="Wijs stijlfamilies toe aan designs zonder familie (via Claude + Notion)"
            >
              {styleFamiliesRunning ? 'Bezig...' : 'Stijlfamilies'}
            </button>
            <a href="/brand-voice" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              Brand Voice
            </a>
            <a href="/upload" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              + Design uploaden
            </a>
            <button className="btn btn-primary" onClick={syncFromNotion} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync vanuit Notion'}
            </button>
          </div>
        </div>
      </header>

      {/* Bulk resultaat */}
      {bulkResult && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${bulkResult.summary.failed > 0 ? '#ef4444' : '#16a34a'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Bulk workflow resultaat</h2>
            <button
              onClick={() => setBulkResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}
            >
              ×
            </button>
          </div>
          <p style={{ marginBottom: 12, color: '#374151' }}>
            <strong>{bulkResult.summary.succeeded}</strong> geslaagd &nbsp;|&nbsp;
            <strong style={{ color: bulkResult.summary.failed > 0 ? '#ef4444' : '#16a34a' }}>
              {bulkResult.summary.failed}
            </strong>{' '}
            mislukt &nbsp;|&nbsp; {bulkResult.summary.total} totaal
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bulkResult.results.map((r) => (
              <div
                key={r.designId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 80, fontSize: 13 }}>{r.designCode}</span>
                <span style={{ color: '#4b5563', fontSize: 13, flex: 1 }}>{r.designName}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {r.steps.map((s) => (
                    <span
                      key={s.step}
                      title={`${s.step}: ${s.detail || s.status}`}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background:
                          s.status === 'ok'
                            ? '#dcfce7'
                            : s.status === 'error'
                            ? '#fee2e2'
                            : '#f3f4f6',
                        color:
                          s.status === 'ok'
                            ? '#166534'
                            : s.status === 'error'
                            ? '#991b1b'
                            : '#6b7280',
                      }}
                    >
                      {STEP_ICON[s.status]} {s.step.replace('_', ' ')}
                    </span>
                  ))}
                </div>
                {r.error && <span style={{ color: '#ef4444', fontSize: 12 }}>{r.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bulk publiceren resultaat */}
      {bulkPublishResult && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${bulkPublishResult.summary.failed > 0 ? '#ef4444' : '#7c3aed'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Shopify publiceer resultaat</h2>
            <button
              onClick={() => setBulkPublishResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}
            >
              ×
            </button>
          </div>
          <p style={{ marginBottom: 12, color: '#374151' }}>
            <strong style={{ color: '#166534' }}>{bulkPublishResult.summary.succeeded}</strong> gepubliceerd &nbsp;|&nbsp;
            <strong style={{ color: '#6b7280' }}>{bulkPublishResult.summary.skipped}</strong> overgeslagen &nbsp;|&nbsp;
            <strong style={{ color: bulkPublishResult.summary.failed > 0 ? '#ef4444' : '#6b7280' }}>
              {bulkPublishResult.summary.failed}
            </strong>{' '}
            mislukt &nbsp;|&nbsp; {bulkPublishResult.summary.total} totaal
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bulkPublishResult.results.map((r) => (
              <div
                key={r.designId}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}
              >
                <span style={{ fontWeight: 600, minWidth: 80, fontSize: 13 }}>{r.designCode}</span>
                <span style={{ color: '#4b5563', fontSize: 13, flex: 1 }}>{r.designName}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: r.status === 'ok' ? '#dcfce7' : r.status === 'error' ? '#fee2e2' : '#f3f4f6',
                    color: r.status === 'ok' ? '#166534' : r.status === 'error' ? '#991b1b' : '#6b7280',
                  }}
                >
                  {r.status === 'ok' ? '✓' : r.status === 'error' ? '✗' : '–'}{' '}
                  {r.status === 'ok' ? `Shopify #${r.shopifyProductId}` : r.detail ?? r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stijlfamilies resultaat */}
      {styleFamiliesResult && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${styleFamiliesResult.notionErrors > 0 ? '#f59e0b' : '#16a34a'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Stijlfamilies resultaat</h2>
            <button
              onClick={() => setStyleFamiliesResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}
            >
              ×
            </button>
          </div>
          <p style={{ marginBottom: 12, color: '#374151' }}>
            <strong style={{ color: '#166534' }}>{styleFamiliesResult.assigned}</strong> toegewezen &nbsp;|&nbsp;
            <strong>{styleFamiliesResult.total}</strong> totaal
            {styleFamiliesResult.notionErrors > 0 && (
              <> &nbsp;|&nbsp; <strong style={{ color: '#d97706' }}>{styleFamiliesResult.notionErrors}</strong> Notion fouten</>
            )}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {styleFamiliesResult.families.map((f) => (
              <span
                key={f.family}
                style={{
                  fontSize: 12,
                  padding: '3px 10px',
                  borderRadius: 12,
                  background: '#f3f4f6',
                  color: '#374151',
                }}
              >
                {f.family} <strong>({f.count})</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="stats">
          {[
            { label: 'Totaal', value: stats.total, filter: '' },
            { label: 'Draft', value: stats.draft, filter: 'DRAFT' },
            { label: 'Review', value: stats.review, filter: 'REVIEW' },
            { label: 'Approved', value: stats.approved, filter: 'APPROVED' },
            { label: 'Live', value: stats.live, filter: 'LIVE' },
          ].map(({ label, value, filter }) => (
            <div
              key={label}
              className="stat"
              onClick={() => setFilterStatus(filterStatus === filter ? '' : filter)}
              style={{ cursor: 'pointer', opacity: filterStatus && filterStatus !== filter ? 0.4 : 1 }}
            >
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Zoek + filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Zoek op naam of code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
          >
            <option value="">Alle statussen</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">Review</option>
            <option value="APPROVED">Approved</option>
            <option value="LIVE">Live</option>
          </select>
        </div>
      </div>

      {/* Design grid */}
      <div className="design-grid">
        {filteredDesigns.map((design) => {
          const { hasNl, hasDe, hasEn, hasVariants } = getWorkflowBadges(design)
          return (
            <div key={design.id} className="design-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div className="design-name">{design.designName}</div>
                  <div className="design-code">{design.designCode}</div>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: STATUS_COLORS[design.status] + '22',
                    color: STATUS_COLORS[design.status],
                    whiteSpace: 'nowrap',
                  }}
                >
                  {design.status}
                </span>
              </div>

              {/* Product types */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                {design.inductionFriendly && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: '#dbeafe', color: '#1e40af' }}>IB</span>
                )}
                {design.circleFriendly && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: '#fce7f3', color: '#9d174d' }}>MC</span>
                )}
                {design.splashFriendly && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: '#d1fae5', color: '#065f46' }}>SP</span>
                )}
              </div>

              {/* Workflow voortgang */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                <span
                  title="NL content"
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 3,
                    background: hasNl ? '#dcfce7' : '#f3f4f6',
                    color: hasNl ? '#166534' : '#9ca3af',
                  }}
                >
                  {hasNl ? '✓' : '○'} NL
                </span>
                <span
                  title="DE vertaling"
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 3,
                    background: hasDe ? '#dcfce7' : '#f3f4f6',
                    color: hasDe ? '#166534' : '#9ca3af',
                  }}
                >
                  {hasDe ? '✓' : '○'} DE
                </span>
                <span
                  title="EN vertaling"
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 3,
                    background: hasEn ? '#dcfce7' : '#f3f4f6',
                    color: hasEn ? '#166534' : '#9ca3af',
                  }}
                >
                  {hasEn ? '✓' : '○'} EN
                </span>
                <span
                  title={`${design.variants.length} varianten`}
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 3,
                    background: hasVariants ? '#dcfce7' : '#f3f4f6',
                    color: hasVariants ? '#166534' : '#9ca3af',
                  }}
                >
                  {hasVariants ? '✓' : '○'} {design.variants.length} var.
                </span>
              </div>

              <div className="design-actions">
                <a href={`/designs/${design.id}`} className="btn btn-primary btn-sm">
                  Beheren
                </a>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    const res = await fetch('/api/notion', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'sync_single', designCode: design.designCode }),
                    })
                    const data = await res.json()
                    if (data.success) {
                      fetchDesigns()
                    }
                  }}
                >
                  Sync
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {filteredDesigns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#666', marginBottom: 20 }}>
            {designs.length === 0
              ? 'Geen designs gevonden. Klik op "Sync vanuit Notion" om je library te importeren.'
              : 'Geen designs gevonden met deze filters.'}
          </p>
        </div>
      )}
    </div>
  )
}
