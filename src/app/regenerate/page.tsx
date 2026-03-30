'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type {
  RegeneratePreviewDesign,
  RegeneratePreviewResponse,
  RegenerateResponse,
} from '@/app/api/regenerate/route'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  CONTENT_GENERATING: '#d97706',
  REVIEW: '#2563eb',
  APPROVED: '#16a34a',
  PUBLISHING: '#7c3aed',
  LIVE: '#15803d',
  ARCHIVED: '#9ca3af',
}

const STEP_LABELS: Record<string, string> = {
  regenerate_nl: 'NL Content',
  translate_de: 'DE Vertaling',
  translate_en: 'EN Vertaling',
  translate_fr: 'FR Vertaling',
  shopify_push: 'Shopify Update',
}

export default function RegeneratePage() {
  // Filter state
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [collectionFilter, setCollectionFilter] = useState('')
  const [styleFamilyFilter, setStyleFamilyFilter] = useState('')

  // Data state
  const [preview, setPreview] = useState<RegeneratePreviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Options
  const [retranslate, setRetranslate] = useState(true)
  const [pushToShopify, setPushToShopify] = useState(false)

  // Execution state
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RegenerateResponse | null>(null)
  const [progress, setProgress] = useState('')

  const fetchPreview = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)
      if (collectionFilter) params.set('collection', collectionFilter)
      if (styleFamilyFilter) params.set('styleFamily', styleFamilyFilter)

      const res = await fetch(`/api/regenerate?${params}`)
      const data: RegeneratePreviewResponse = await res.json()
      setPreview(data)
    } catch (err) {
      console.error('Preview fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, collectionFilter, styleFamilyFilter])

  // Debounced fetch
  useEffect(() => {
    const timer = setTimeout(fetchPreview, 300)
    return () => clearTimeout(timer)
  }, [fetchPreview])

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (!preview) return
    if (selected.size === preview.designs.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.designs.map((d) => d.id)))
    }
  }

  const selectByStatus = (status: string) => {
    if (!preview) return
    const ids = preview.designs.filter((d) => d.status === status).map((d) => d.id)
    setSelected(new Set(ids))
  }

  // Execute regeneration
  const runRegenerate = async () => {
    if (selected.size === 0) return

    setRunning(true)
    setResult(null)
    setProgress(`Bezig met regenereren van ${selected.size} design${selected.size > 1 ? 's' : ''}...`)

    try {
      const res = await fetch('/api/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designIds: Array.from(selected),
          retranslate,
          pushToShopify,
        }),
      })

      const data: RegenerateResponse = await res.json()
      setResult(data)
      setProgress('')
      // Refresh preview to show updated state
      fetchPreview()
    } catch (err) {
      setProgress(`Fout: ${err}`)
    } finally {
      setRunning(false)
    }
  }

  const allSelected = preview ? selected.size === preview.designs.length && preview.designs.length > 0 : false

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0 }}>
          Content Regenereren
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
          Genereer NL content opnieuw met de huidige brand voice en vertaal optioneel naar alle talen.
        </p>
      </div>

      {/* Info banner */}
      <div style={{
        padding: '12px 16px',
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 8,
        fontSize: 13,
        color: '#1e40af',
        marginBottom: 20,
        lineHeight: 1.5,
      }}>
        Na het aanpassen van de <Link href="/brand-voice" style={{ color: '#2563eb', fontWeight: 600 }}>brand voice</Link> kun
        je hier bestaande content opnieuw laten genereren. Selecteer de designs die je wilt bijwerken, kies de opties en start de regeneratie.
        Maximaal 50 designs per keer.
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <input
          type="text"
          placeholder="Zoek op naam of code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            width: 220,
          }}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            background: '#fff',
          }}
        >
          <option value="">Alle statussen</option>
          <option value="LIVE">LIVE</option>
          <option value="REVIEW">REVIEW</option>
          <option value="APPROVED">APPROVED</option>
          <option value="DRAFT">DRAFT</option>
        </select>

        <select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            background: '#fff',
          }}
        >
          <option value="">Alle collecties</option>
          {preview?.collections.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={styleFamilyFilter}
          onChange={(e) => setStyleFamilyFilter(e.target.value)}
          style={{
            padding: '7px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            fontSize: 13,
            background: '#fff',
          }}
        >
          <option value="">Alle stijlfamilies</option>
          {preview?.styleFamilies.map((sf) => (
            <option key={sf} value={sf}>{sf}</option>
          ))}
        </select>

        {(search || statusFilter || collectionFilter || styleFamilyFilter) && (
          <button
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setCollectionFilter('')
              setStyleFamilyFilter('')
            }}
            style={{
              padding: '7px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 13,
              background: '#fff',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            Filters wissen
          </button>
        )}
      </div>

      {/* Quick select buttons */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Snel selecteren:</span>
        <button
          onClick={selectAll}
          style={{
            padding: '4px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            fontSize: 12,
            background: allSelected ? '#dbeafe' : '#fff',
            cursor: 'pointer',
            color: '#374151',
          }}
        >
          {allSelected ? 'Deselecteer alles' : 'Selecteer alles'}
        </button>
        <button
          onClick={() => selectByStatus('LIVE')}
          style={{
            padding: '4px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            fontSize: 12,
            background: '#fff',
            cursor: 'pointer',
            color: '#15803d',
          }}
        >
          Alle LIVE
        </button>
        <button
          onClick={() => selectByStatus('REVIEW')}
          style={{
            padding: '4px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            fontSize: 12,
            background: '#fff',
            cursor: 'pointer',
            color: '#2563eb',
          }}
        >
          Alle REVIEW
        </button>
        <button
          onClick={() => setSelected(new Set())}
          style={{
            padding: '4px 10px',
            border: '1px solid #d1d5db',
            borderRadius: 4,
            fontSize: 12,
            background: '#fff',
            cursor: 'pointer',
            color: '#6b7280',
          }}
        >
          Wis selectie
        </button>

        <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, marginLeft: 8 }}>
          {selected.size} van {preview?.total ?? 0} geselecteerd
        </span>
      </div>

      {/* Design table */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 20,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, width: 36 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={selectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Code</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Design</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Type</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>Content</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>Shopify</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>Varianten</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                  Laden...
                </td>
              </tr>
            ) : preview && preview.designs.length > 0 ? (
              preview.designs.map((d) => (
                <DesignRow
                  key={d.id}
                  design={d}
                  isSelected={selected.has(d.id)}
                  onToggle={() => toggleSelect(d.id)}
                />
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                  Geen designs gevonden met deze filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Options + Execute panel */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 20,
        background: '#f9fafb',
        marginBottom: 20,
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px', color: '#111' }}>
          Regeneratie opties
        </h3>

        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={retranslate}
              onChange={(e) => setRetranslate(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>
              <strong>Opnieuw vertalen</strong>
              <span style={{ color: '#6b7280', marginLeft: 4 }}>(DE, EN, FR)</span>
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={pushToShopify}
              onChange={(e) => setPushToShopify(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>
              <strong>Push naar Shopify</strong>
              <span style={{ color: '#6b7280', marginLeft: 4 }}>(alleen LIVE producten)</span>
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={runRegenerate}
            disabled={running || selected.size === 0}
            style={{
              padding: '9px 20px',
              background: running || selected.size === 0 ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: running || selected.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {running
              ? 'Bezig...'
              : `Regenereer ${selected.size} design${selected.size !== 1 ? 's' : ''}`}
          </button>

          {progress && (
            <span style={{ fontSize: 13, color: '#d97706' }}>{progress}</span>
          )}

          {selected.size > 50 && (
            <span style={{ fontSize: 12, color: '#dc2626' }}>
              Max 50 per keer. De eerste 50 worden verwerkt.
            </span>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {/* Summary bar */}
          <div style={{
            padding: '12px 16px',
            background: result.summary.failed > 0 ? '#fef2f2' : '#f0fdf4',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            fontSize: 14,
          }}>
            <span style={{ fontWeight: 600 }}>Resultaat</span>
            <span style={{ color: '#16a34a' }}>{result.summary.regenerated} geregenereerd</span>
            {result.summary.failed > 0 && (
              <span style={{ color: '#dc2626' }}>{result.summary.failed} mislukt</span>
            )}
            {result.summary.skipped > 0 && (
              <span style={{ color: '#6b7280' }}>{result.summary.skipped} overgeslagen</span>
            )}
          </div>

          {/* Per-design results */}
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {result.results.map((r) => (
              <div
                key={r.designId}
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid #f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Link
                  href={`/designs/${r.designId}`}
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: '#2563eb',
                    textDecoration: 'none',
                    minWidth: 70,
                  }}
                >
                  {r.designCode}
                </Link>
                <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{r.designName}</span>

                {r.error ? (
                  <span style={{ fontSize: 12, color: '#dc2626' }}>Fout: {r.error}</span>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.steps.map((s) => (
                      <span
                        key={s.step}
                        title={`${STEP_LABELS[s.step] || s.step}: ${s.status}${s.detail ? ` - ${s.detail}` : ''}`}
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          background:
                            s.status === 'ok' ? '#dcfce7'
                            : s.status === 'skipped' ? '#f3f4f6'
                            : '#fee2e2',
                          color:
                            s.status === 'ok' ? '#15803d'
                            : s.status === 'skipped' ? '#6b7280'
                            : '#dc2626',
                        }}
                      >
                        {STEP_LABELS[s.step] || s.step}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DesignRow({
  design,
  isSelected,
  onToggle,
}: {
  design: RegeneratePreviewDesign
  isSelected: boolean
  onToggle: () => void
}) {
  const langFlags = [
    { has: design.hasNlContent, flag: '🇳🇱' },
    { has: design.hasDeContent, flag: '🇩🇪' },
    { has: design.hasEnContent, flag: '🇬🇧' },
    { has: design.hasFrContent, flag: '🇫🇷' },
  ]

  return (
    <tr
      style={{
        borderBottom: '1px solid #f3f4f6',
        background: isSelected ? '#eff6ff' : undefined,
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <td style={{ padding: '8px 12px' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        />
      </td>
      <td style={{ padding: '8px 12px' }}>
        <Link
          href={`/designs/${design.id}`}
          onClick={(e) => e.stopPropagation()}
          style={{ fontFamily: 'monospace', fontSize: 12, color: '#2563eb', textDecoration: 'none' }}
        >
          {design.designCode}
        </Link>
      </td>
      <td style={{ padding: '8px 12px', fontWeight: 500, color: '#111' }}>
        {design.designName}
      </td>
      <td style={{ padding: '8px 12px', color: '#6b7280' }}>
        {design.designType}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          background: `${STATUS_COLORS[design.status] || '#6b7280'}18`,
          color: STATUS_COLORS[design.status] || '#6b7280',
        }}>
          {design.status}
        </span>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        <span style={{ fontSize: 13, letterSpacing: 1 }}>
          {langFlags.map((l) => (
            <span key={l.flag} style={{ opacity: l.has ? 1 : 0.2 }}>{l.flag}</span>
          ))}
        </span>
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
        {design.onShopify ? (
          <span style={{ color: '#16a34a', fontSize: 13 }}>Ja</span>
        ) : (
          <span style={{ color: '#9ca3af', fontSize: 13 }}>Nee</span>
        )}
      </td>
      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280' }}>
        {design.variantCount}
      </td>
    </tr>
  )
}
