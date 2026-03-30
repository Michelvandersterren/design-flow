import React from 'react'
import type { Design, Variant } from './types'

interface VariantsTabProps {
  design: Design
  generating: boolean
  onGenerateVariants: () => void
}

const materialPlainMap: Record<string, string> = { IB: 'Vinyl', SP: 'Aluminium-Dibond' }
const spMaterialLabels: Record<string, string> = { GLAS: 'Gehard Glas', BRUSHED: 'Brushed Aluminium', ALU: 'Aluminium-Dibond' }
const mcMaterialLabels: Record<string, string> = { ADI: 'Aluminium Dibond', FRX: 'Forex' }

function getVariantMaterialFeed(v: Variant): string {
  if (v.productType === 'SP' && v.material) return spMaterialLabels[v.material] ?? v.material
  if (v.productType === 'MC' && v.material) return mcMaterialLabels[v.material] ?? v.material
  return materialPlainMap[v.productType] ?? '\u2014'
}

function getWidthCm(v: Variant): string {
  if (v.productType === 'MC') return (Math.round(Number(v.size)) / 10).toFixed(1)
  const w = Number(v.size.split('x')[0])
  return (Math.round(w) / 10).toFixed(1)
}

function getHeightCm(v: Variant): string {
  if (v.productType === 'MC') return (Math.round(Number(v.size)) / 10).toFixed(1)
  const h = Number(v.size.split('x')[1])
  return (Math.round(h) / 10).toFixed(1)
}

export function VariantsTab({ design, generating, onGenerateVariants }: VariantsTabProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Varianten ({design.variants.length})</h2>
        <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onGenerateVariants} disabled={generating}>
          {generating ? 'Aanmaken...' : design.variants.length > 0 ? 'Opnieuw aanmaken' : 'Varianten aanmaken'}
        </button>
      </div>
      {design.variants.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                {['Type', 'Maat (mm)', 'SKU', 'EAN', 'Prijs', 'Shopify ID'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
                <th colSpan={4} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#6b7280', borderLeft: '2px solid #e5e7eb', fontSize: 11 }}>
                  Shopify Metafields (variant)
                </th>
              </tr>
              <tr style={{ borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
                {['', '', '', '', '', ''].map((_, i) => (
                  <th key={i} style={{ padding: '0 12px 6px' }} />
                ))}
                {[
                  { key: 'materiaal', label: 'materiaal' },
                  { key: 'breedte', label: 'breedte (cm)' },
                  { key: 'hoogte', label: 'hoogte (cm)' },
                  { key: 'mpn', label: 'mpn' },
                ].map(({ key, label }) => (
                  <th key={key} style={{ textAlign: 'left', padding: '0 12px 6px', fontWeight: 500, color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderLeft: key === 'materiaal' ? '2px solid #e5e7eb' : undefined }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {design.variants.map((v, i) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '7px 12px' }}><span className="badge badge-draft" style={{ fontSize: 10 }}>{v.productType}</span></td>
                  <td style={{ padding: '7px 12px', fontWeight: 500 }}>{v.size}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#374151' }}>{v.sku}</td>
                  <td style={{ padding: '7px 12px', color: '#6b7280' }}>{v.ean || '\u2014'}</td>
                  <td style={{ padding: '7px 12px', fontWeight: 500 }}>{v.price != null ? `\u20AC${v.price.toFixed(2)}` : '\u2014'}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', fontSize: 10, color: v.shopifyProductId ? '#16a34a' : '#9ca3af' }}>
                    {v.shopifyProductId || '\u2014'}
                  </td>
                  <td style={{ padding: '7px 12px', color: '#374151', borderLeft: '2px solid #e5e7eb' }}>{getVariantMaterialFeed(v)}</td>
                  <td style={{ padding: '7px 12px', color: '#374151' }}>{getWidthCm(v)}</td>
                  <td style={{ padding: '7px 12px', color: '#374151' }}>{getHeightCm(v)}</td>
                  <td style={{ padding: '7px 12px', fontFamily: 'monospace', color: '#6b7280', fontSize: 11 }}>{v.sku}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <p style={{ marginBottom: 12 }}>Nog geen varianten aangemaakt.</p>
          <button className="btn btn-primary" onClick={onGenerateVariants} disabled={generating}>
            {generating ? 'Aanmaken...' : 'Varianten aanmaken'}
          </button>
        </div>
      )}
    </div>
  )
}
