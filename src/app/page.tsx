'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

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

interface PaginatedResponse {
  designs: Design[]
  total: number
  page: number
  limit: number
  pages: number
  stats: Record<string, number>
  collections: string[]
  styleFamilies: string[]
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
  const [bulkApproving, setBulkApproving] = useState(false)

  // Pagination & filter state
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [collections, setCollections] = useState<string[]>([])
  const [styleFamilies, setStyleFamilies] = useState<string[]>([])

  // Filter inputs
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCollection, setFilterCollection] = useState('')
  const [filterStyleFamily, setFilterStyleFamily] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchTerm)
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchTerm])

  const fetchDesigns = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '50')
      params.set('sort', sortField)
      params.set('dir', sortDir)
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (filterStatus) params.set('status', filterStatus)
      if (filterCollection) params.set('collection', filterCollection)
      if (filterStyleFamily) params.set('styleFamily', filterStyleFamily)

      const res = await fetch(`/api/designs?${params}`)
      const data: PaginatedResponse = await res.json()
      setDesigns(data.designs || [])
      setTotal(data.total)
      setTotalPages(data.pages)
      setStats(data.stats || {})
      if (data.collections) setCollections(data.collections)
      if (data.styleFamilies) setStyleFamilies(data.styleFamilies)
    } catch (err) {
      console.error('Error fetching designs:', err)
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, filterStatus, filterCollection, filterStyleFamily, sortField, sortDir])

  useEffect(() => {
    fetchDesigns()
  }, [fetchDesigns])

  // Reset page on filter change
  const handleFilterChange = (setter: (v: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'designName' ? 'asc' : 'desc')
    }
    setPage(1)
  }

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
    const draftCount = stats.DRAFT || 0
    if (draftCount === 0) {
      alert('Geen DRAFT designs om te verwerken.')
      return
    }
    if (!confirm(`Bulk workflow starten voor ${draftCount} DRAFT designs?\n\nDit genereert AI content (NL), vertaalt naar DE + EN + FR en maakt varianten aan.`)) return

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
    const publishableCount = stats.APPROVED || 0
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

  const runBulkApprove = async () => {
    const reviewCount = stats.REVIEW || 0
    if (reviewCount === 0) return
    if (!confirm(`${reviewCount} REVIEW designs goedkeuren?`)) return

    setBulkApproving(true)
    try {
      // Fetch all REVIEW design IDs
      const res = await fetch('/api/designs?status=REVIEW&limit=100')
      const data = await res.json()
      const designIds = (data.designs || []).map((d: Design) => d.id)

      if (designIds.length === 0) return

      const bulkRes = await fetch('/api/designs/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designIds, status: 'APPROVED' }),
      })
      if (!bulkRes.ok) {
        const err = await bulkRes.json()
        throw new Error(err.error || 'Bulk goedkeuren mislukt')
      }
      await fetchDesigns()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bulk goedkeuren mislukt')
    } finally {
      setBulkApproving(false)
    }
  }

  // Client-side type filter (product type is not a DB column for filtering)
  const filteredDesigns = filterType
    ? designs.filter((d) =>
        (filterType === 'IB' && d.inductionFriendly) ||
        (filterType === 'SP' && d.splashFriendly) ||
        (filterType === 'MC' && d.circleFriendly)
      )
    : designs

  const totalStat = Object.values(stats).reduce((a, b) => a + b, 0)

  const getWorkflowBadges = (design: Design) => {
    const hasNl = design.content.some((c) => c.language === 'nl')
    const hasDe = design.content.some((c) => c.language === 'de')
    const hasEn = design.content.some((c) => c.language === 'en')
    const hasFr = design.content.some((c) => c.language === 'fr')
    const hasVariants = design.variants.length > 0
    return { hasNl, hasDe, hasEn, hasFr, hasVariants }
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
            {(stats.DRAFT || 0) > 0 && (
              <button
                className="btn btn-success"
                onClick={runBulkWorkflow}
                disabled={bulkRunning}
                title="Genereer content, vertaal naar DE + EN + FR en maak varianten voor alle DRAFT designs"
              >
                {bulkRunning ? 'Bezig...' : `Verwerk ${stats.DRAFT} DRAFT designs`}
              </button>
            )}
            {(stats.REVIEW || 0) > 0 && (
              <button
                className="btn btn-success"
                onClick={runBulkApprove}
                disabled={bulkApproving}
                title="Keur alle REVIEW designs goed"
                style={{ background: '#2563eb', borderColor: '#2563eb' }}
              >
                {bulkApproving ? 'Bezig...' : `Keur ${stats.REVIEW} REVIEW goed`}
              </button>
            )}
            {(stats.APPROVED || 0) > 0 && (
              <button
                className="btn btn-success"
                onClick={runBulkPublish}
                disabled={bulkPublishRunning}
                title="Publiceer alle APPROVED designs naar Shopify als draft"
                style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
              >
                {bulkPublishRunning
                  ? 'Publiceren...'
                  : `Publiceer ${stats.APPROVED} naar Shopify`}
              </button>
            )}
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

      {/* Stats */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="stats">
          {[
            { label: 'Totaal', value: totalStat, filter: '' },
            { label: 'Draft', value: stats.DRAFT || 0, filter: 'DRAFT' },
            { label: 'Review', value: stats.REVIEW || 0, filter: 'REVIEW' },
            { label: 'Approved', value: stats.APPROVED || 0, filter: 'APPROVED' },
            { label: 'Live', value: stats.LIVE || 0, filter: 'LIVE' },
          ].map(({ label, value, filter }) => (
            <div
              key={label}
              className="stat"
              onClick={() => handleFilterChange(setFilterStatus, filterStatus === filter ? '' : filter)}
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
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0, minWidth: 200 }}>
            <input
              type="text"
              placeholder="Zoek op naam of code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { code: 'IB', label: 'IB' },
              { code: 'SP', label: 'SP' },
              { code: 'MC', label: 'MC' },
            ].map(({ code, label }) => (
              <button
                key={code}
                onClick={() => setFilterType(filterType === code ? '' : code)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid #e5e7eb',
                  background: filterType === code ? '#2563eb' : '#fff',
                  color: filterType === code ? '#fff' : '#374151',
                  fontWeight: filterType === code ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => handleFilterChange(setFilterStatus, e.target.value)}
            style={{ padding: '10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
          >
            <option value="">Alle statussen</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">Review</option>
            <option value="APPROVED">Approved</option>
            <option value="LIVE">Live</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          {collections.length > 0 && (
            <select
              value={filterCollection}
              onChange={(e) => handleFilterChange(setFilterCollection, e.target.value)}
              style={{ padding: '10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
            >
              <option value="">Alle collecties</option>
              {collections.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {styleFamilies.length > 0 && (
            <select
              value={filterStyleFamily}
              onChange={(e) => handleFilterChange(setFilterStyleFamily, e.target.value)}
              style={{ padding: '10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
            >
              <option value="">Alle stijlfamilies</option>
              {styleFamilies.map((sf) => (
                <option key={sf} value={sf}>{sf}</option>
              ))}
            </select>
          )}
          <select
            value={`${sortField}-${sortDir}`}
            onChange={(e) => {
              const [f, d] = e.target.value.split('-')
              setSortField(f)
              setSortDir(d as 'asc' | 'desc')
              setPage(1)
            }}
            style={{ padding: '10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
          >
            <option value="updatedAt-desc">Laatst bijgewerkt</option>
            <option value="createdAt-desc">Nieuwste eerst</option>
            <option value="createdAt-asc">Oudste eerst</option>
            <option value="designName-asc">Naam A-Z</option>
            <option value="designName-desc">Naam Z-A</option>
            <option value="designCode-asc">Code A-Z</option>
          </select>
        </div>
      </div>

      {/* Resultaat info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {total} designs gevonden
          {totalPages > 1 && ` — pagina ${page} van ${totalPages}`}
        </span>
        {(filterStatus || filterCollection || filterStyleFamily || filterType || debouncedSearch) && (
          <button
            onClick={() => {
              setSearchTerm('')
              setDebouncedSearch('')
              setFilterStatus('')
              setFilterType('')
              setFilterCollection('')
              setFilterStyleFamily('')
              setPage(1)
            }}
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 4,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#6b7280',
              cursor: 'pointer',
            }}
          >
            Filters wissen
          </button>
        )}
      </div>

      {/* Design grid */}
      <div className="design-grid">
        {filteredDesigns.map((design) => {
          const { hasNl, hasDe, hasEn, hasFr, hasVariants } = getWorkflowBadges(design)
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

              {/* Collection tag */}
              {design.collections && (
                <div style={{ marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: '#f5f3ff',
                      color: '#6d28d9',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleFilterChange(setFilterCollection, design.collections || '')}
                    title={`Filter op ${design.collections}`}
                  >
                    {design.collections}
                  </span>
                </div>
              )}

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
                  title="FR vertaling"
                  style={{
                    fontSize: 11,
                    padding: '2px 7px',
                    borderRadius: 3,
                    background: hasFr ? '#dcfce7' : '#f3f4f6',
                    color: hasFr ? '#166534' : '#9ca3af',
                  }}
                >
                  {hasFr ? '✓' : '○'} FR
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
                <Link href={`/designs/${design.id}`} className="btn btn-primary btn-sm">
                  Beheren
                </Link>
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
                {['DRAFT', 'REVIEW'].includes(design.status) && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={async () => {
                      if (!confirm(`"${design.designName}" verwijderen?`)) return
                      try {
                        const res = await fetch(`/api/designs/${design.id}`, { method: 'DELETE' })
                        const data = await res.json()
                        if (data.success) fetchDesigns()
                        else alert('Verwijderen mislukt')
                      } catch { alert('Verwijderen mislukt') }
                    }}
                  >
                    Verwijder
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredDesigns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#666', marginBottom: 20 }}>
            {total === 0 && !debouncedSearch && !filterStatus && !filterCollection && !filterStyleFamily
              ? 'Geen designs gevonden. Klik op "Sync vanuit Notion" om je library te importeren.'
              : 'Geen designs gevonden met deze filters.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={page <= 1}
            onClick={() => setPage(1)}
            title="Eerste pagina"
          >
            ««
          </button>
          <button
            className="pagination-btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            «
          </button>
          {generatePageNumbers(page, totalPages).map((p, i) =>
            p === null ? (
              <span key={`ellipsis-${i}`} className="pagination-ellipsis">...</span>
            ) : (
              <button
                key={p}
                className={`pagination-btn ${page === p ? 'pagination-btn-active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            )
          )}
          <button
            className="pagination-btn"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            »
          </button>
          <button
            className="pagination-btn"
            disabled={page >= totalPages}
            onClick={() => setPage(totalPages)}
            title="Laatste pagina"
          >
            »»
          </button>
        </div>
      )}
    </div>
  )
}

function generatePageNumbers(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | null)[] = [1]

  if (current > 3) pages.push(null)

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push(null)

  pages.push(total)
  return pages
}
