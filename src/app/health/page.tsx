'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { DesignHealth, HealthResponse, IssueCode } from '@/app/api/health/route'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#6b7280',
  CONTENT_GENERATING: '#d97706',
  REVIEW: '#2563eb',
  APPROVED: '#16a34a',
  PUBLISHING: '#7c3aed',
  LIVE: '#15803d',
  ARCHIVED: '#9ca3af',
}

const ISSUE_COLORS: Record<IssueCode, string> = {
  NO_NL_CONTENT: '#dc2626',
  INCOMPLETE_NL_CONTENT: '#ea580c',
  NO_DE_TRANSLATION: '#d97706',
  NO_EN_TRANSLATION: '#d97706',
  NO_FR_TRANSLATION: '#d97706',
  NO_VARIANTS: '#dc2626',
  MISSING_EAN: '#ea580c',
  NO_MOCKUPS: '#7c3aed',
  NO_PRINT_FILES: '#7c3aed',
  NO_SHOPIFY_PRODUCT: '#dc2626',
  FAILED_WORKFLOW_STEP: '#dc2626',
  NO_DRIVE_IMAGE: '#dc2626',
}

const ISSUE_ICONS: Record<IssueCode, string> = {
  NO_NL_CONTENT: '📝',
  INCOMPLETE_NL_CONTENT: '📝',
  NO_DE_TRANSLATION: '🇩🇪',
  NO_EN_TRANSLATION: '🇬🇧',
  NO_FR_TRANSLATION: '🇫🇷',
  NO_VARIANTS: '📦',
  MISSING_EAN: '🏷️',
  NO_MOCKUPS: '🖼️',
  NO_PRINT_FILES: '🖨️',
  NO_SHOPIFY_PRODUCT: '🛒',
  FAILED_WORKFLOW_STEP: '⚠️',
  NO_DRIVE_IMAGE: '📁',
}

// Issue categories for grouping stats
const ISSUE_CATEGORIES: { label: string; issues: IssueCode[] }[] = [
  {
    label: 'Content',
    issues: ['NO_NL_CONTENT', 'INCOMPLETE_NL_CONTENT', 'NO_DE_TRANSLATION', 'NO_EN_TRANSLATION', 'NO_FR_TRANSLATION'],
  },
  {
    label: 'Productie',
    issues: ['NO_VARIANTS', 'MISSING_EAN', 'NO_MOCKUPS', 'NO_PRINT_FILES'],
  },
  {
    label: 'Publicatie',
    issues: ['NO_SHOPIFY_PRODUCT', 'FAILED_WORKFLOW_STEP', 'NO_DRIVE_IMAGE'],
  },
]

export default function HealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [issueFilter, setIssueFilter] = useState<IssueCode | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [page, setPage] = useState(1)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset page on filter changes
  useEffect(() => {
    setPage(1)
  }, [issueFilter, statusFilter, searchDebounced])

  const fetchHealth = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (issueFilter) params.set('issue', issueFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (searchDebounced) params.set('search', searchDebounced)
      params.set('page', String(page))
      params.set('limit', '50')

      const res = await fetch(`/api/health?${params}`)
      const json: HealthResponse = await res.json()
      setData(json)
    } catch (err) {
      console.error('Error fetching health data:', err)
    } finally {
      setLoading(false)
    }
  }, [issueFilter, statusFilter, searchDebounced, page])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
        Health check laden...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container">
        <div className="error">Kon health check data niet laden.</div>
      </div>
    )
  }

  const { designs, total, pages, summary, issueLabels, totalWithIssues, totalHealthy } = data

  return (
    <div className="container">
      {/* Header */}
      <header style={{ marginBottom: 20 }}>
        <h1>Health Check</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
          Overzicht van ontbrekende of onvolledige items per design
        </p>
      </header>

      {/* Summary stats */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="stats">
          <div
            className="stat"
            onClick={() => { setIssueFilter(''); setStatusFilter('') }}
            style={{ cursor: 'pointer', opacity: !issueFilter ? 1 : 0.5 }}
          >
            <div className="stat-value" style={{ color: totalWithIssues > 0 ? '#dc2626' : '#16a34a' }}>
              {totalWithIssues}
            </div>
            <div className="stat-label">Met issues</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: '#16a34a' }}>{totalHealthy}</div>
            <div className="stat-label">Gezond</div>
          </div>
          <div className="stat">
            <div className="stat-value" style={{ color: '#2563eb' }}>{totalWithIssues + totalHealthy}</div>
            <div className="stat-label">Totaal</div>
          </div>
        </div>
      </div>

      {/* Issue category breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {ISSUE_CATEGORIES.map((cat) => (
          <div className="card" key={cat.label} style={{ padding: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>
              {cat.label}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cat.issues.map((code) => {
                const count = summary[code] || 0
                const isActive = issueFilter === code
                return (
                  <button
                    key={code}
                    onClick={() => setIssueFilter(isActive ? '' : code)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background: isActive ? ISSUE_COLORS[code] + '18' : count > 0 ? '#f9fafb' : 'transparent',
                      cursor: count > 0 ? 'pointer' : 'default',
                      fontSize: 13,
                      color: count > 0 ? '#374151' : '#d1d5db',
                      fontWeight: isActive ? 600 : 400,
                      textAlign: 'left',
                      transition: 'background 0.15s',
                    }}
                    disabled={count === 0}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14 }}>{ISSUE_ICONS[code]}</span>
                      {issueLabels[code]}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: count > 0 ? ISSUE_COLORS[code] : '#d1d5db',
                      minWidth: 28,
                      textAlign: 'right',
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
          <input
            type="text"
            placeholder="Zoek op naam of code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', width: '100%', fontSize: 14 }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14 }}
        >
          <option value="">Alle statussen</option>
          <option value="DRAFT">Draft</option>
          <option value="REVIEW">Review</option>
          <option value="APPROVED">Approved</option>
          <option value="LIVE">Live</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        {(issueFilter || statusFilter || search) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { setIssueFilter(''); setStatusFilter(''); setSearch('') }}
          >
            Filters wissen
          </button>
        )}
        <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 'auto' }}>
          {total} design{total !== 1 ? 's' : ''} gevonden
        </span>
      </div>

      {/* Results table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ ...thStyle, width: 100 }}>Code</th>
              <th style={{ ...thStyle, minWidth: 180 }}>Design</th>
              <th style={{ ...thStyle, width: 90, textAlign: 'center' }}>Status</th>
              <th style={{ ...thStyle }}>Issues</th>
              <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>V</th>
              <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>M</th>
              <th style={{ ...thStyle, width: 60, textAlign: 'center' }}>P</th>
              <th style={{ ...thStyle, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {designs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
                  {issueFilter || statusFilter || search
                    ? 'Geen designs gevonden met deze filters.'
                    : 'Alle designs zijn gezond.'}
                </td>
              </tr>
            ) : (
              designs.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                      {d.designCode}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <Link
                      href={`/designs/${d.id}`}
                      style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                    >
                      {d.designName}
                    </Link>
                    {d.designType && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 5px',
                        borderRadius: 3,
                        background: '#f3f4f6',
                        color: '#6b7280',
                        marginLeft: 6,
                      }}>
                        {d.designType}
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: (STATUS_COLORS[d.status] || '#6b7280') + '22',
                      color: STATUS_COLORS[d.status] || '#6b7280',
                      whiteSpace: 'nowrap',
                    }}>
                      {d.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {d.issues.map((issue) => (
                        <button
                          key={issue}
                          onClick={() => setIssueFilter(issueFilter === issue ? '' : issue)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 11,
                            fontWeight: 500,
                            padding: '2px 7px',
                            borderRadius: 4,
                            border: 'none',
                            background: ISSUE_COLORS[issue] + '15',
                            color: ISSUE_COLORS[issue],
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                          title={issueLabels[issue]}
                        >
                          <span style={{ fontSize: 12 }}>{ISSUE_ICONS[issue]}</span>
                          {issueLabels[issue]}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ color: d.variantCount > 0 ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                      {d.variantCount}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ color: d.mockupCount > 0 ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                      {d.mockupCount}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ color: d.printFileCount > 0 ? '#16a34a' : '#dc2626', fontWeight: 600, fontSize: 13 }}>
                      {d.printFileCount}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <Link
                      href={`/designs/${d.id}`}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: 12, padding: '4px 10px', textDecoration: 'none' }}
                    >
                      Bekijk
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Vorige
          </button>
          {buildPageNumbers(page, pages).map((p, i) =>
            p === '...' ? (
              <span key={`e${i}`} className="pagination-ellipsis">...</span>
            ) : (
              <button
                key={p}
                className={`pagination-btn ${page === p ? 'pagination-btn-active' : ''}`}
                onClick={() => setPage(p as number)}
              >
                {p}
              </button>
            )
          )}
          <button
            className="pagination-btn"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Volgende
          </button>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 14px',
  verticalAlign: 'middle',
}

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
