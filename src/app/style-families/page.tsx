'use client'

import { useEffect, useState, useCallback } from 'react'

interface DesignInFamily {
  code: string
  name: string
}

interface FamilyData {
  [family: string]: DesignInFamily[]
}

interface StyleFamiliesResponse {
  total: number
  withFamily: number
  families: FamilyData
}

interface GenerateResult {
  success: boolean
  total: number
  assigned: number
  notionErrors: number
  families: { family: string; count: number }[]
}

const FAMILY_COLORS = [
  { bg: '#dbeafe', text: '#1e40af' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#d1fae5', text: '#065f46' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#fee2e2', text: '#991b1b' },
  { bg: '#e0f2fe', text: '#075985' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fdf4ff', text: '#7e22ce' },
  { bg: '#fff7ed', text: '#c2410c' },
  { bg: '#f0fdf4', text: '#15803d' },
  { bg: '#faf5ff', text: '#6b21a8' },
]

function familyColor(index: number) {
  return FAMILY_COLORS[index % FAMILY_COLORS.length]
}

export default function StyleFamiliesPage() {
  const [data, setData] = useState<StyleFamiliesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null)
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/designs/style-families')
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error('Fout bij ophalen stijlfamilies:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const runGenerate = async (overwrite: boolean) => {
    const confirmMsg = overwrite
      ? `Stijlfamilies opnieuw genereren voor ALLE designs?\n\nBestaande stijlfamilies worden overschreven.`
      : `Stijlfamilies genereren voor designs zonder familie?\n\nDesigns die al een familie hebben worden overgeslagen.`
    if (!confirm(confirmMsg)) return

    setGenerating(true)
    setGenerateResult(null)
    try {
      const res = await fetch('/api/designs/style-families', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite, notionSync: true }),
      })
      const json = await res.json()
      setGenerateResult(json)
      await fetchData()
    } catch {
      alert('Genereren mislukt')
    } finally {
      setGenerating(false)
    }
  }

  const families = data ? Object.entries(data.families) : []
  const withoutFamily = families.find(([key]) => key === '(geen)')
  const withFamily = families.filter(([key]) => key !== '(geen)')

  const filteredFamilies = withFamily.filter(([family, designs]) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      family.toLowerCase().includes(term) ||
      designs.some(
        (d) =>
          d.name.toLowerCase().includes(term) ||
          d.code.toLowerCase().includes(term)
      )
    )
  })

  const withoutCount = withoutFamily ? withoutFamily[1].length : 0

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a
              href="/"
              style={{ color: '#6b7280', textDecoration: 'none', fontSize: 14 }}
            >
              ← Dashboard
            </a>
            <h1 style={{ margin: 0 }}>Stijlfamilies</h1>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {withoutCount > 0 && (
              <button
                className="btn btn-success"
                onClick={() => runGenerate(false)}
                disabled={generating}
                title={`Genereer stijlfamilies voor ${withoutCount} designs zonder familie`}
              >
                {generating ? 'Bezig...' : `Genereer voor ${withoutCount} designs`}
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => runGenerate(true)}
              disabled={generating}
              title="Herbereken stijlfamilies voor alle designs (overschrijft bestaande)"
            >
              {generating ? 'Bezig...' : 'Alles herbereken'}
            </button>
          </div>
        </div>
      </header>

      {/* Resultaat na genereren */}
      {generateResult && (
        <div
          className="card"
          style={{
            marginBottom: 20,
            borderLeft: `4px solid ${generateResult.notionErrors > 0 ? '#f59e0b' : '#16a34a'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Resultaat</h2>
            <button
              onClick={() => setGenerateResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}
            >
              ×
            </button>
          </div>
          <p style={{ marginBottom: 12, color: '#374151' }}>
            <strong style={{ color: '#166534' }}>{generateResult.assigned}</strong> toegewezen van{' '}
            <strong>{generateResult.total}</strong> designs
            {generateResult.notionErrors > 0 && (
              <>
                {' '}
                — <strong style={{ color: '#d97706' }}>{generateResult.notionErrors}</strong> Notion schrijffouten
              </>
            )}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {generateResult.families.map((f, i) => {
              const color = familyColor(i)
              return (
                <span
                  key={f.family}
                  style={{
                    fontSize: 12,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: color.bg,
                    color: color.text,
                    fontWeight: 500,
                  }}
                >
                  {f.family} ({f.count})
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{data?.total ?? 0}</div>
            <div className="stat-label">Totaal designs</div>
          </div>
          <div className="stat">
            <div className="stat-value">{data?.withFamily ?? 0}</div>
            <div className="stat-label">Met familie</div>
          </div>
          <div className="stat">
            <div className="stat-value">{withoutCount}</div>
            <div className="stat-label" style={{ color: withoutCount > 0 ? '#d97706' : undefined }}>
              Zonder familie
            </div>
          </div>
          <div className="stat">
            <div className="stat-value">{withFamily.length}</div>
            <div className="stat-label">Families</div>
          </div>
        </div>
      </div>

      {/* Designs zonder familie */}
      {withoutFamily && withoutFamily[1].length > 0 && (
        <div
          className="card"
          style={{ marginBottom: 20, borderLeft: '4px solid #f59e0b' }}
        >
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setExpandedFamily(expandedFamily === '(geen)' ? null : '(geen)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ margin: 0, color: '#92400e' }}>Geen familie toegewezen</h3>
              <span
                style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: '#fef3c7',
                  color: '#92400e',
                  fontWeight: 600,
                }}
              >
                {withoutFamily[1].length}
              </span>
            </div>
            <span style={{ color: '#9ca3af', fontSize: 14 }}>
              {expandedFamily === '(geen)' ? '▲' : '▼'}
            </span>
          </div>
          {expandedFamily === '(geen)' && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {withoutFamily[1].map((d) => (
                <a
                  key={d.code}
                  href={`/designs/${d.code}`}
                  style={{
                    fontSize: 12,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: '#f3f4f6',
                    color: '#374151',
                    textDecoration: 'none',
                    border: '1px solid #e5e7eb',
                  }}
                  title={d.name}
                >
                  {d.code}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zoek */}
      {withFamily.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Zoek op familienaam, designnaam of code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Families grid */}
      {filteredFamilies.length === 0 && !withoutFamily && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#666', marginBottom: 20 }}>
            Geen stijlfamilies gevonden. Klik op &quot;Genereer voor ... designs&quot; om te starten.
          </p>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {filteredFamilies.map(([family, designs], index) => {
          const color = familyColor(index)
          const isExpanded = expandedFamily === family
          return (
            <div
              key={family}
              className="card"
              style={{ cursor: 'pointer', borderTop: `3px solid ${color.text}` }}
              onClick={() => setExpandedFamily(isExpanded ? null : family)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>{family}</h3>
                  <span
                    style={{
                      fontSize: 12,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: color.bg,
                      color: color.text,
                      fontWeight: 600,
                    }}
                  >
                    {designs.length}
                  </span>
                </div>
                <span style={{ color: '#9ca3af', fontSize: 13 }}>{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Preview: altijd de eerste 5 codes zichtbaar */}
              {!isExpanded && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {designs.slice(0, 5).map((d) => (
                    <span
                      key={d.code}
                      title={d.name}
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 3,
                        background: color.bg,
                        color: color.text,
                      }}
                    >
                      {d.code}
                    </span>
                  ))}
                  {designs.length > 5 && (
                    <span style={{ fontSize: 11, color: '#9ca3af', padding: '2px 6px' }}>
                      +{designs.length - 5} meer
                    </span>
                  )}
                </div>
              )}

              {/* Uitgevouwen: alle designs als klikbare links */}
              {isExpanded && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {designs.map((d) => (
                      <a
                        key={d.code}
                        href={`/designs/${d.code}`}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '5px 8px',
                          borderRadius: 4,
                          textDecoration: 'none',
                          background: '#f9fafb',
                          border: '1px solid #f3f4f6',
                          color: '#374151',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLAnchorElement).style.background = color.bg
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLAnchorElement).style.background = '#f9fafb'
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            minWidth: 60,
                            color: color.text,
                          }}
                        >
                          {d.code}
                        </span>
                        <span style={{ fontSize: 12, color: '#4b5563' }}>{d.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
