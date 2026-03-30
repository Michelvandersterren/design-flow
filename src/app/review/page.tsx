'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import type { ReviewDesign, ReviewResponse, QualityIssue, Severity } from '@/app/api/review/route'

// ── Constants ───────────────────────────────────────────────────────────────

const LANG_FLAGS: Record<string, string> = { nl: '🇳🇱', de: '🇩🇪', en: '🇬🇧', fr: '🇫🇷' }
const LANG_LABELS: Record<string, string> = { nl: 'Nederlands', de: 'Duits', en: 'Engels', fr: 'Frans' }
const LANG_ORDER = ['nl', 'de', 'en', 'fr']
const TRANSLATABLE_LANGS = ['de', 'en', 'fr']

const FIELD_LABELS: Record<string, string> = {
  seoTitle: 'SEO Titel',
  seoDescription: 'SEO Beschrijving',
  description: 'Korte beschrijving',
  longDescription: 'Lange beschrijving',
  googleShoppingDescription: 'Google Shopping',
  general: 'Algemeen',
}

const CONTENT_FIELDS = ['seoTitle', 'seoDescription', 'description', 'longDescription', 'googleShoppingDescription'] as const
type ContentFieldKey = typeof CONTENT_FIELDS[number]

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

// ── Highlight helper ────────────────────────────────────────────────────────

/** Highlight matched words in text, returning an array of React nodes. */
function highlightWords(text: string, words: string[]): ReactNode[] {
  if (!words || words.length === 0) return [text]

  // Build a single regex matching all words (case-insensitive, longest first)
  const sorted = [...words].sort((a, b) => b.length - a.length)
  const escaped = sorted.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')

  const parts = text.split(regex)
  return parts.map((part, i) => {
    if (regex.test(part)) {
      return (
        <mark key={i} style={{
          background: '#fde68a',
          color: '#92400e',
          borderRadius: 2,
          padding: '0 2px',
          fontWeight: 600,
        }}>
          {part}
        </mark>
      )
    }
    // Reset regex lastIndex after test
    regex.lastIndex = 0
    return part
  })
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
      // Fetch all REVIEW design IDs (not just current page)
      const allRes = await fetch('/api/designs?status=REVIEW&limit=100')
      const allData = await allRes.json()
      const designIds = (allData.designs || []).map((d: any) => d.id)

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
      setSelectedId(null)
      await fetchData()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bulk goedkeuren mislukt')
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
            onDataChange={fetchData}
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
  onDataChange,
}: {
  design: ReviewDesign
  approving: boolean
  onApprove: () => void
  onReject: () => void
  onDataChange: () => Promise<void>
}) {
  const [activeLang, setActiveLang] = useState('nl')
  const [regenerating, setRegenerating] = useState(false)
  const [regeneratingField, setRegeneratingField] = useState<ContentFieldKey | null>(null)
  const [translating, setTranslating] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<ContentFieldKey | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const content = design.content.find((c) => c.language === activeLang)
  const quality = design.quality.find((q) => q.language === activeLang)
  const sortedContent = [...design.content].sort(
    (a, b) => LANG_ORDER.indexOf(a.language) - LANG_ORDER.indexOf(b.language)
  )

  // Clear action message after 4 seconds
  useEffect(() => {
    if (!actionMessage) return
    const t = setTimeout(() => setActionMessage(null), 4000)
    return () => clearTimeout(t)
  }, [actionMessage])

  // Reset edit state when design or language changes
  useEffect(() => {
    setEditingField(null)
    setEditValue('')
  }, [design.id, activeLang])

  // ── Regenerate all NL content ─────────────────────────────────────────

  const handleRegenerate = async () => {
    if (!confirm('NL content opnieuw genereren? Dit overschrijft de huidige Nederlandse content.')) return
    setRegenerating(true)
    setActionMessage(null)
    try {
      const productType = design.designType === 'IB' ? 'INDUCTION'
        : design.designType === 'MC' ? 'CIRCLE'
        : design.designType === 'SP' ? 'SPLASH'
        : 'INDUCTION'

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId: design.id, productType }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Content generatie mislukt')
      }

      // Auto-translate to existing languages
      const existingLangs = design.content
        .map((c) => c.language)
        .filter((l) => TRANSLATABLE_LANGS.includes(l))

      for (const lang of existingLangs) {
        await fetch(`/api/designs/${design.id}/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang }),
        })
      }

      setActionMessage({
        text: `Content gegenereerd${existingLangs.length > 0 ? ` en vertaald naar ${existingLangs.map((l) => LANG_LABELS[l]).join(', ')}` : ''}`,
        type: 'success',
      })
      setActiveLang('nl')
      await onDataChange()
    } catch (e) {
      setActionMessage({ text: e instanceof Error ? e.message : 'Generatie mislukt', type: 'error' })
    } finally {
      setRegenerating(false)
    }
  }

  // ── Regenerate single field ───────────────────────────────────────────

  const handleRegenerateField = async (field: ContentFieldKey) => {
    setRegeneratingField(field)
    setActionMessage(null)
    try {
      const res = await fetch('/api/ai/regenerate-field', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId: design.id, field, language: activeLang }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Hergenereren mislukt')
      }
      setActionMessage({ text: `${FIELD_LABELS[field]} opnieuw gegenereerd`, type: 'success' })
      await onDataChange()
    } catch (e) {
      setActionMessage({ text: e instanceof Error ? e.message : 'Hergenereren mislukt', type: 'error' })
    } finally {
      setRegeneratingField(null)
    }
  }

  // ── Retranslate single language ───────────────────────────────────────

  const handleRetranslate = async (lang: string) => {
    setTranslating(lang)
    setActionMessage(null)
    try {
      const res = await fetch(`/api/designs/${design.id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Vertaling mislukt')
      }
      setActionMessage({ text: `${LANG_LABELS[lang]} vertaling bijgewerkt`, type: 'success' })
      await onDataChange()
    } catch (e) {
      setActionMessage({ text: e instanceof Error ? e.message : 'Vertaling mislukt', type: 'error' })
    } finally {
      setTranslating(null)
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────

  const startEdit = (field: ContentFieldKey) => {
    if (!content) return
    setEditingField(field)
    setEditValue((content as Record<string, string | null>)[field] || '')
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  const saveEdit = async () => {
    if (!editingField) return
    setSaving(true)
    setActionMessage(null)
    try {
      const res = await fetch(`/api/designs/${design.id}/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: activeLang, [editingField]: editValue }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Opslaan mislukt')
      }
      const savedField = editingField
      setEditingField(null)
      setEditValue('')
      setActionMessage({ text: `${FIELD_LABELS[savedField] || savedField} opgeslagen`, type: 'success' })
      await onDataChange()
    } catch (e) {
      setActionMessage({ text: e instanceof Error ? e.message : 'Opslaan mislukt', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Action message bar */}
      {actionMessage && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          background: actionMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
          color: actionMessage.type === 'success' ? '#065f46' : '#991b1b',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {actionMessage.text}
          <button
            onClick={() => setActionMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'inherit', padding: '0 4px' }}
          >
            x
          </button>
        </div>
      )}

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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Regenerate button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRegenerate}
            disabled={regenerating}
            style={{ fontSize: 13 }}
            title="NL content opnieuw genereren + vertalingen bijwerken"
          >
            {regenerating ? 'Genereren...' : 'Hergenereren'}
          </button>
          <Link
            href={`/designs/${design.id}`}
            className="btn btn-secondary btn-sm"
            style={{ textDecoration: 'none', fontSize: 13 }}
          >
            Detailpagina
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
          {/* Language tabs + retranslate button */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb', paddingBottom: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {sortedContent.map((c) => {
                const q = design.quality.find((qItem) => qItem.language === c.language)
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
            {/* Retranslate button for non-NL languages */}
            {TRANSLATABLE_LANGS.includes(activeLang) && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleRetranslate(activeLang)}
                disabled={translating === activeLang}
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                title={`${LANG_LABELS[activeLang]} opnieuw vertalen vanuit NL`}
              >
                {translating === activeLang ? 'Vertalen...' : 'Hervertalen'}
              </button>
            )}
          </div>

          {content ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <ContentField
                label="SEO Titel"
                field="seoTitle"
                value={content.seoTitle}
                maxLength={60}
                issues={quality?.issues.filter((i) => i.field === 'seoTitle') || []}
                editing={editingField === 'seoTitle'}
                editValue={editValue}
                saving={saving}
                regenerating={regeneratingField === 'seoTitle'}
                onStartEdit={() => startEdit('seoTitle')}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onEditChange={setEditValue}
                onRegenerate={() => handleRegenerateField('seoTitle')}
              />
              <ContentField
                label="SEO Beschrijving"
                field="seoDescription"
                value={content.seoDescription}
                maxLength={160}
                issues={quality?.issues.filter((i) => i.field === 'seoDescription') || []}
                editing={editingField === 'seoDescription'}
                editValue={editValue}
                saving={saving}
                regenerating={regeneratingField === 'seoDescription'}
                onStartEdit={() => startEdit('seoDescription')}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onEditChange={setEditValue}
                onRegenerate={() => handleRegenerateField('seoDescription')}
              />
              <ContentField
                label="Korte beschrijving"
                field="description"
                value={content.description}
                issues={quality?.issues.filter((i) => i.field === 'description') || []}
                editing={editingField === 'description'}
                editValue={editValue}
                saving={saving}
                regenerating={regeneratingField === 'description'}
                onStartEdit={() => startEdit('description')}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onEditChange={setEditValue}
                onRegenerate={() => handleRegenerateField('description')}
              />
              <ContentField
                label="Lange beschrijving"
                field="longDescription"
                value={content.longDescription}
                multiline
                issues={quality?.issues.filter((i) => i.field === 'longDescription') || []}
                editing={editingField === 'longDescription'}
                editValue={editValue}
                saving={saving}
                regenerating={regeneratingField === 'longDescription'}
                onStartEdit={() => startEdit('longDescription')}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onEditChange={setEditValue}
                onRegenerate={() => handleRegenerateField('longDescription')}
              />
              <ContentField
                label="Google Shopping"
                field="googleShoppingDescription"
                value={content.googleShoppingDescription}
                minLength={300}
                maxLength={500}
                multiline
                issues={quality?.issues.filter((i) => i.field === 'googleShoppingDescription') || []}
                editing={editingField === 'googleShoppingDescription'}
                editValue={editValue}
                saving={saving}
                regenerating={regeneratingField === 'googleShoppingDescription'}
                onStartEdit={() => startEdit('googleShoppingDescription')}
                onCancelEdit={cancelEdit}
                onSaveEdit={saveEdit}
                onEditChange={setEditValue}
                onRegenerate={() => handleRegenerateField('googleShoppingDescription')}
              />
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
  field,
  value,
  maxLength,
  minLength,
  multiline,
  issues,
  editing,
  editValue,
  saving,
  regenerating,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditChange,
  onRegenerate,
}: {
  label: string
  field: ContentFieldKey
  value: string | null
  maxLength?: number
  minLength?: number
  multiline?: boolean
  issues: QualityIssue[]
  editing: boolean
  editValue: string
  saving: boolean
  regenerating: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onEditChange: (value: string) => void
  onRegenerate: () => void
}) {
  const hasErrors = issues.some((i) => i.severity === 'error')
  const hasWarnings = issues.some((i) => i.severity === 'warning')
  const displayValue = editing ? editValue : value
  const len = displayValue?.length || 0

  // Collect all matched words from issues for this field
  const wordsToHighlight = issues
    .flatMap((i) => i.matchedWords || [])
    .filter((w, idx, arr) => arr.indexOf(w) === idx)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {hasErrors && <span style={{ fontSize: 12 }}>🔴</span>}
          {!hasErrors && hasWarnings && <span style={{ fontSize: 12 }}>🟡</span>}
          {!hasErrors && !hasWarnings && value && <span style={{ fontSize: 12 }}>🟢</span>}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {(maxLength || minLength) && displayValue && (
            <span style={{
              fontSize: 11,
              color: (maxLength && len > maxLength) || (minLength && len < minLength) ? '#dc2626' : '#9ca3af',
              fontFamily: 'monospace',
            }}>
              {len}{maxLength ? `/${maxLength}` : ''} tekens
            </span>
          )}
          {editing ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={onCancelEdit}
                disabled={saving}
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                Annuleren
              </button>
              <button
                onClick={onSaveEdit}
                disabled={saving}
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 4 }}>
              {/* Per-field regenerate button — only show when there are warnings */}
              {hasWarnings && (
                <button
                  onClick={onRegenerate}
                  disabled={regenerating}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid #f59e0b',
                    background: '#fffbeb',
                    color: '#92400e',
                    cursor: 'pointer',
                  }}
                  title={`${label} opnieuw laten genereren door AI`}
                >
                  {regenerating ? 'Bezig...' : 'Herschrijven'}
                </button>
              )}
              <button
                onClick={onStartEdit}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb',
                  color: '#6b7280',
                  cursor: 'pointer',
                }}
                title={`${label} bewerken`}
              >
                Bewerken
              </button>
            </div>
          )}
        </div>
      </div>

      {editing ? (
        multiline ? (
          <textarea
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancelEdit()
            }}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 6,
              border: '2px solid #2563eb',
              background: '#fff',
              fontSize: 14,
              lineHeight: 1.6,
              minHeight: 120,
              resize: 'vertical',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        ) : (
          <input
            type="text"
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 6,
              border: '2px solid #2563eb',
              background: '#fff',
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: 'inherit',
              outline: 'none',
            }}
          />
        )
      ) : (
        <div
          onClick={onStartEdit}
          style={{
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
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          title="Klik om te bewerken"
        >
          {value
            ? wordsToHighlight.length > 0
              ? highlightWords(value, wordsToHighlight)
              : value
            : 'Niet ingevuld'}
        </div>
      )}

      {/* Character length bar for SEO fields */}
      {maxLength && displayValue && (
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
      {issues.length > 0 && !editing && (
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
