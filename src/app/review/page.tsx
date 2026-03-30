'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { ReviewDesign, ReviewResponse, QualityIssue, Severity } from '@/app/api/review/route'

// ── Constants ───────────────────────────────────────────────────────────────

const LANG_FLAGS: Record<string, string> = { nl: '🇳🇱', de: '🇩🇪', en: '🇬🇧', fr: '🇫🇷' }
const LANG_LABELS: Record<string, string> = { nl: 'Nederlands', de: 'Duits', en: 'Engels', fr: 'Frans' }
const LANG_ORDER = ['nl', 'de', 'en', 'fr']

const FIELD_LABELS: Record<string, string> = {
  seoTitle: 'SEO Titel',
  seoDescription: 'SEO Beschrijving',
  description: 'Korte beschrijving',
  longDescription: 'Lange beschrijving',
  googleShoppingDescription: 'Google Shopping',
  general: 'Algemeen',
}

function scoreColor(score: number): string {
  if (score >= 90) return '#16a34a'
  if (score >= 70) return '#d97706'
  return '#dc2626'
}

function scoreBg(score: number): string {
  if (score >= 90) return '#d1fae5'
  if (score >= 70) return '#fef3c7'
  return '#fee2e2'
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const [data, setData] = useState<ReviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('REVIEW')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [page, setPage] = useState(1)
  const [approving, setApproving] = useState<string | null>(null)
  const [bulkApproving, setBulkApproving] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [statusFilter, searchDebounced])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (searchDebounced) params.set('search', searchDebounced)
      params.set('page', String(page))
      params.set('limit', '20')

      const res = await fetch(`/api/review?${params}`)
      const json: ReviewResponse = await res.json()
      setData(json)

      // Auto-select first design if none selected
      if (!selectedId && json.designs.length > 0) {
        setSelectedId(json.designs[0].id)
      }
    } catch (err) {
      console.error('Error fetching review data:', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchDebounced, page])

  useEffect(() => { fetchData() }, [fetchData])

  const handleStatusChange = async (designId: string, newStatus: string) => {
    setApproving(designId)
    try {
      const res = await fetch(`/api/designs/${designId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        await fetchData()
        // If we just approved/rejected the selected design, select the next one
        if (data && selectedId === designId) {
          const idx = data.designs.findIndex((d) => d.id === designId)
          const next = data.designs[idx + 1] || data.designs[idx - 1]
          setSelectedId(next?.id || null)
        }
      }
    } catch {
      alert(`Status wijzigen mislukt`)
    } finally {
      setApproving(null)
    }
  }

  const handleBulkApprove = async () => {
    if (!data || data.designs.length === 0) return
    const count = data.designs.filter((d) => d.status === 'REVIEW').length
    if (count === 0) return
    if (!confirm(`${count} design(s) goedkeuren?`)) return

    setBulkApproving(true)
    try {
      // Fetch all REVIEW designs (not just current page)
      const allRes = await fetch('/api/designs?status=REVIEW&limit=100')
      const allData = await allRes.json()
      const reviewDesigns = allData.designs || []

      await Promise.all(
        reviewDesigns.map((d: any) =>
          fetch(`/api/designs/${d.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'APPROVED' }),
          })
        )
      )
      setSelectedId(null)
      await fetchData()
    } catch {
      alert('Bulk goedkeuren mislukt')
    } finally {
      setBulkApproving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
        Review laden...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container">
        <div className="error">Kon review data niet laden.</div>
      </div>
    )
  }

  const selected = data.designs.find((d) => d.id === selectedId) || null

  return (
    <div className="container" style={{ maxWidth: 1600 }}>
      {/* Header */}
      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Content Review</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
            Beoordeel en keur content goed voor publicatie
          </p>
        </div>
        {statusFilter === 'REVIEW' && data.stats.review > 0 && (
          <button
            className="btn btn-success"
            onClick={handleBulkApprove}
            disabled={bulkApproving}
            title={`Alle ${data.stats.review} REVIEW designs goedkeuren`}
          >
            {bulkApproving ? 'Bezig...' : `Alles goedkeuren (${data.stats.review})`}
          </button>
        )}
      </header>

      {/* Stats */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="stats">
          <div
            className="stat"
            onClick={() => setStatusFilter('REVIEW')}
            style={{ cursor: 'pointer', opacity: statusFilter === 'REVIEW' ? 1 : 0.5 }}
          >
            <div className="stat-value" style={{ color: '#2563eb' }}>{data.stats.review}</div>
            <div className="stat-label">Te beoordelen</div>
          </div>
          <div
            className="stat"
            onClick={() => setStatusFilter('APPROVED')}
            style={{ cursor: 'pointer', opacity: statusFilter === 'APPROVED' ? 1 : 0.5 }}
          >
            <div className="stat-value" style={{ color: '#16a34a' }}>{data.stats.approved}</div>
            <div className="stat-label">Goedgekeurd</div>
          </div>
          <div
            className="stat"
            onClick={() => setStatusFilter('DRAFT')}
            style={{ cursor: 'pointer', opacity: statusFilter === 'DRAFT' ? 1 : 0.5 }}
          >
            <div className="stat-value" style={{ color: '#6b7280' }}>{data.stats.draft}</div>
            <div className="stat-label">Draft</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
          <input
            type="text"
            placeholder="Zoek op naam of code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', width: '100%', fontSize: 14 }}
          />
        </div>
        {search && (
          <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
            Wissen
          </button>
        )}
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 'auto' }}>
          {data.total} design{data.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Split layout: queue + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.designs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>
              {statusFilter === 'REVIEW'
                ? 'Geen designs om te beoordelen.'
                : `Geen ${statusFilter} designs gevonden.`}
            </div>
          ) : (
            data.designs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 8,
                  border: selectedId === d.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  background: selectedId === d.id ? '#eff6ff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                {/* Score badge */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: scoreBg(d.overallScore),
                  color: scoreColor(d.overallScore),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}>
                  {d.overallScore}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {d.designName}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ fontFamily: 'monospace' }}>{d.designCode}</span>
                    {d.designType && <span>{d.designType}</span>}
                    <span>{d.content.length} talen</span>
                  </div>
                </div>
                {/* Language flags */}
                <div style={{ display: 'flex', gap: 2, fontSize: 14, flexShrink: 0 }}>
                  {LANG_ORDER.map((lang) => {
                    const has = d.content.some((c) => c.language === lang)
                    return (
                      <span key={lang} style={{ opacity: has ? 1 : 0.2 }}>
                        {LANG_FLAGS[lang]}
                      </span>
                    )
                  })}
                </div>
              </button>
            ))
          )}

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="pagination" style={{ marginTop: 8 }}>
              <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                &lt;
              </button>
              <span style={{ fontSize: 13, color: '#6b7280', padding: '0 8px' }}>
                {page} / {data.pages}
              </span>
              <button className="pagination-btn" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
                &gt;
              </button>
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {selected ? (
          <DetailPanel
            design={selected}
            approving={approving === selected.id}
            onApprove={() => handleStatusChange(selected.id, 'APPROVED')}
            onReject={() => handleStatusChange(selected.id, 'DRAFT')}
          />
        ) : (
          <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: 60 }}>
            Selecteer een design om te beoordelen
          </div>
        )}
      </div>
    </div>
  )
}

// ── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({
  design,
  approving,
  onApprove,
  onReject,
}: {
  design: ReviewDesign
  approving: boolean
  onApprove: () => void
  onReject: () => void
}) {
  const [activeLang, setActiveLang] = useState('nl')
  const content = design.content.find((c) => c.language === activeLang)
  const quality = design.quality.find((q) => q.language === activeLang)
  const sortedContent = [...design.content].sort(
    (a, b) => LANG_ORDER.indexOf(a.language) - LANG_ORDER.indexOf(b.language)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header bar */}
      <div className="card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{design.designName}</div>
            <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', gap: 10, marginTop: 2 }}>
              <span style={{ fontFamily: 'monospace' }}>{design.designCode}</span>
              {design.designType && <span>{design.designType}</span>}
              {design.collections && (
                <span>{(() => { try { return JSON.parse(design.collections).join(', ') } catch { return design.collections } })()}</span>
              )}
            </div>
          </div>
          {/* Overall score */}
          <div style={{
            padding: '4px 12px',
            borderRadius: 6,
            background: scoreBg(design.overallScore),
            color: scoreColor(design.overallScore),
            fontWeight: 700,
            fontSize: 16,
          }}>
            {design.overallScore}/100
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/designs/${design.id}`}
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none', fontSize: 13 }}
          >
            Bewerken
          </Link>
          {design.status === 'REVIEW' && (
            <>
              <button
                className="btn btn-danger btn-sm"
                onClick={onReject}
                disabled={approving}
                style={{ fontSize: 13 }}
              >
                Afwijzen
              </button>
              <button
                className="btn btn-success btn-sm"
                onClick={onApprove}
                disabled={approving}
                style={{ fontSize: 13 }}
              >
                {approving ? 'Bezig...' : 'Goedkeuren'}
              </button>
            </>
          )}
          {design.status === 'APPROVED' && (
            <span className="badge badge-approved">Goedgekeurd</span>
          )}
          {design.status === 'DRAFT' && (
            <span className="badge badge-draft">Draft</span>
          )}
        </div>
      </div>

      {/* Design image + content side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
        {/* Left: Image + meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {design.driveFileId ? (
            <div className="card" style={{ padding: 8 }}>
              <img
                src={`/api/drive-image/${design.driveFileId}`}
                alt={design.designName}
                style={{ width: '100%', borderRadius: 6, display: 'block' }}
              />
            </div>
          ) : (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9ca3af', background: '#f9fafb' }}>
              Geen afbeelding
            </div>
          )}

          {/* Meta info */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Status
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <MetaRow label="Varianten" value={String(design.variantCount)} ok={design.variantCount > 0} />
              <MetaRow label="Mockups" value={String(design.mockupCount)} ok={design.mockupCount > 0} />
              <MetaRow label="Talen" value={design.content.map((c) => LANG_FLAGS[c.language] || c.language).join(' ')} ok={design.content.length >= 3} />
            </div>
          </div>

          {/* Per-language scores */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Kwaliteitsscores
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {design.quality
                .sort((a, b) => LANG_ORDER.indexOf(a.language) - LANG_ORDER.indexOf(b.language))
                .map((q) => (
                  <button
                    key={q.language}
                    onClick={() => setActiveLang(q.language)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: activeLang === q.language ? '1px solid #2563eb' : '1px solid transparent',
                      background: activeLang === q.language ? '#eff6ff' : '#f9fafb',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {LANG_FLAGS[q.language]} {LANG_LABELS[q.language] || q.language}
                      {q.issues.length > 0 && (
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                          {q.issues.length} melding{q.issues.length !== 1 ? 'en' : ''}
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontWeight: 700,
                      color: scoreColor(q.score),
                      fontSize: 13,
                    }}>
                      {q.score}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Content fields */}
        <div className="card" style={{ padding: 20 }}>
          {/* Language tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
            {sortedContent.map((c) => {
              const q = design.quality.find((q) => q.language === c.language)
              const isActive = c.language === activeLang
              return (
                <button
                  key={c.language}
                  onClick={() => setActiveLang(c.language)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: isActive ? '#2563eb' : 'transparent',
                    color: isActive ? '#fff' : '#374151',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {LANG_FLAGS[c.language]} {LANG_LABELS[c.language] || c.language}
                  {q && q.issues.length > 0 && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: isActive ? 'rgba(255,255,255,0.3)' : scoreColor(q.score) + '22',
                      color: isActive ? '#fff' : scoreColor(q.score),
                    }}>
                      {q.issues.length}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {content ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <ContentField
                label="SEO Titel"
                value={content.seoTitle}
                maxLength={60}
                issues={quality?.issues.filter((i) => i.field === 'seoTitle') || []}
              />
              <ContentField
                label="SEO Beschrijving"
                value={content.seoDescription}
                maxLength={160}
                issues={quality?.issues.filter((i) => i.field === 'seoDescription') || []}
              />
              <ContentField
                label="Korte beschrijving"
                value={content.description}
                issues={quality?.issues.filter((i) => i.field === 'description') || []}
              />
              <ContentField
                label="Lange beschrijving"
                value={content.longDescription}
                multiline
                issues={quality?.issues.filter((i) => i.field === 'longDescription') || []}
              />
              <ContentField
                label="Google Shopping"
                value={content.googleShoppingDescription}
                minLength={300}
                maxLength={500}
                issues={quality?.issues.filter((i) => i.field === 'googleShoppingDescription') || []}
              />

              {/* General quality issues */}
              {quality && quality.issues.filter((i) => i.field === 'general').length > 0 && (
                <div style={{ padding: 14, borderRadius: 8, background: '#fef3c7', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
                    Algemene opmerkingen
                  </div>
                  {quality.issues
                    .filter((i) => i.field === 'general')
                    .map((issue, idx) => (
                      <div key={idx} style={{ fontSize: 13, color: '#92400e', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{issue.severity === 'error' ? '🔴' : '🟡'}</span>
                        {issue.message}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              Geen content voor {LANG_LABELS[activeLang] || activeLang}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Content Field Component ─────────────────────────────────────────────────

function ContentField({
  label,
  value,
  maxLength,
  minLength,
  multiline,
  issues,
}: {
  label: string
  value: string | null
  maxLength?: number
  minLength?: number
  multiline?: boolean
  issues: QualityIssue[]
}) {
  const hasErrors = issues.some((i) => i.severity === 'error')
  const hasWarnings = issues.some((i) => i.severity === 'warning')
  const len = value?.length || 0

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {hasErrors && <span style={{ fontSize: 12 }}>🔴</span>}
          {!hasErrors && hasWarnings && <span style={{ fontSize: 12 }}>🟡</span>}
          {!hasErrors && !hasWarnings && value && <span style={{ fontSize: 12 }}>🟢</span>}
        </label>
        {(maxLength || minLength) && value && (
          <span style={{
            fontSize: 11,
            color: (maxLength && len > maxLength) || (minLength && len < minLength) ? '#dc2626' : '#9ca3af',
            fontFamily: 'monospace',
          }}>
            {len}{maxLength ? `/${maxLength}` : ''} tekens
          </span>
        )}
      </div>

      <div style={{
        padding: '10px 14px',
        borderRadius: 6,
        border: `1px solid ${hasErrors ? '#fca5a5' : hasWarnings ? '#fde68a' : '#e5e7eb'}`,
        background: hasErrors ? '#fef2f2' : hasWarnings ? '#fffbeb' : '#f9fafb',
        fontSize: 14,
        color: value ? '#111' : '#9ca3af',
        lineHeight: 1.6,
        whiteSpace: multiline ? 'pre-wrap' : 'normal',
        minHeight: multiline ? 80 : undefined,
        maxHeight: multiline ? 200 : undefined,
        overflowY: multiline ? 'auto' : undefined,
      }}>
        {value || 'Niet ingevuld'}
      </div>

      {/* Character length bar for SEO fields */}
      {maxLength && value && (
        <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, (len / maxLength) * 100)}%`,
            borderRadius: 2,
            background: len > maxLength ? '#dc2626' : len > maxLength * 0.85 ? '#d97706' : '#16a34a',
            transition: 'width 0.2s',
          }} />
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {issues.map((issue, idx) => (
            <div key={idx} style={{
              fontSize: 12,
              color: issue.severity === 'error' ? '#dc2626' : '#92400e',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>{issue.severity === 'error' ? '🔴' : '🟡'}</span>
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Meta Row Component ──────────────────────────────────────────────────────

function MetaRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600, color: ok ? '#16a34a' : '#dc2626' }}>{value}</span>
    </div>
  )
}
