import React from 'react'
import type { Design, Content, ContentEditFields } from './types'
import { ContentField } from './shared'

interface ContentTabProps {
  design: Design
  generating: boolean
  translating: string | null
  contentEditMode: Record<string, boolean>
  contentEditValues: Record<string, ContentEditFields>
  contentSaving: Record<string, boolean>
  onGenerateContent: (productType: string) => void
  onTranslateContent: (language: string) => void
  onOpenContentEdit: (lang: string, content: Content) => void
  onCancelContentEdit: (lang: string) => void
  onSaveContentEdit: (lang: string) => void
  onContentEditChange: (lang: string, field: keyof ContentEditFields, value: string) => void
}

function getProductType(d: Design): string {
  if (d.inductionFriendly) return 'INDUCTION'
  if (d.circleFriendly) return 'CIRCLE'
  if (d.splashFriendly) return 'SPLASH'
  return 'INDUCTION'
}

export function ContentTab({
  design, generating, translating,
  contentEditMode, contentEditValues, contentSaving,
  onGenerateContent, onTranslateContent,
  onOpenContentEdit, onCancelContentEdit, onSaveContentEdit, onContentEditChange,
}: ContentTabProps) {
  const nlContent = design.content.find((c) => c.language === 'nl')
  const deContent = design.content.find((c) => c.language === 'de')
  const enContent = design.content.find((c) => c.language === 'en')
  const frContent = design.content.find((c) => c.language === 'fr')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Shopify Metafields */}
      {nlContent && (() => {
        const firstType = design.variants[0]?.productType
        const materialPlain: Record<string, string> = { IB: 'Vinyl', MC: 'Aluminium-Dibond', SP: 'Aluminium-Dibond' }
        const materialFull: Record<string, string> = { IB: 'Vinyl texture overlay', MC: 'Aluminium-Dibond matte', SP: 'Aluminium-Dibond matte' }
        const firstMockupFileId = design.mockups?.[0]?.driveFileId ?? null
        const fields: { label: string; value: string | null }[] = [
          { label: 'custom.manufacturer', value: 'probo' },
          { label: 'custom.modelnaam', value: design.designName },
          { label: 'custom.color_plain', value: (() => {
            const parseF = (v: string | null): string[] => { if (!v) return []; try { const p = JSON.parse(v); if (Array.isArray(p)) return p.map(String).filter(Boolean) } catch { /* ignore */ } return v.split(',').map(s => s.trim()).filter(Boolean) }
            const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
            return parseF(design.colorTags).map(cap).join(', ') || 'Multicolor'
          })() },
          { label: 'custom.google_custom_product', value: 'True' },
          { label: 'custom.material', value: firstType ? (materialFull[firstType] ?? null) : null },
          { label: 'custom.material_plain', value: firstType ? (materialPlain[firstType] ?? null) : null },
          { label: 'custom.beschrijving_afbeelding', value: firstMockupFileId },
          { label: 'custom.product_information', value: nlContent.description },
          { label: 'custom.marketplace_description', value: nlContent.longDescription ? '(HTML versie van lange beschrijving)' : null },
          { label: 'custom.long_description', value: nlContent.longDescription ? '(Rich text versie van lange beschrijving)' : null },
          { label: 'custom.google_description', value: nlContent.googleShoppingDescription },
          { label: 'global.title_tag', value: nlContent.seoTitle },
          { label: 'global.description_tag', value: nlContent.seoDescription },
          { label: 'mm-google-shopping.condition', value: 'new' },
          { label: 'mm-google-shopping.gender', value: 'unisex' },
          { label: 'mm-google-shopping.age_group', value: 'adult' },
        ]
        return (
          <div className="card" style={{ marginBottom: 0 }}>
            <h2 style={{ marginTop: 0, marginBottom: 14 }}>Shopify Metafields (product)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '4px 16px' }}>
              {fields.map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'monospace' }}>{label}</span>
                  {value
                    ? <span style={{ fontSize: 12, color: '#374151', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value}>{value}</span>
                    : <span style={{ fontSize: 12, color: '#d1d5db', marginTop: 2, fontStyle: 'italic' }}>{'\u2014'} niet ingevuld</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {(['nl', 'de', 'en', 'fr'] as const).map((lang) => {
          const c = lang === 'nl' ? nlContent : lang === 'de' ? deContent : lang === 'en' ? enContent : frContent
          const editing = contentEditMode[lang]
          const vals = contentEditValues[lang]
          const isSaving = contentSaving[lang]
          const langLabel = { nl: 'Nederlands', de: 'Deutsch', en: 'English', fr: 'Fran\u00E7ais' }[lang]

          return (
            <div className="card" key={lang}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>
                  <span style={{ fontSize: 16, marginRight: 6 }}>{lang === 'nl' ? '\uD83C\uDDF3\uD83C\uDDF1' : lang === 'de' ? '\uD83C\uDDE9\uD83C\uDDEA' : lang === 'en' ? '\uD83C\uDDEC\uD83C\uDDE7' : '\uD83C\uDDEB\uD83C\uDDF7'}</span>
                  {langLabel}
                </h2>
                {c && !editing && (
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => onOpenContentEdit(lang, c)}>Bewerken</button>
                )}
              </div>

              {c ? (
                editing && vals ? (
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { field: 'seoTitle' as const, label: 'SEO Title', type: 'input' },
                      { field: 'seoDescription' as const, label: 'SEO Description', type: 'textarea2' },
                      { field: 'googleShoppingDescription' as const, label: 'Google Shopping', type: 'input' },
                      { field: 'description' as const, label: 'Korte beschrijving', type: 'textarea3' },
                      { field: 'longDescription' as const, label: 'Lange beschrijving', type: 'textarea6' },
                    ].map(({ field, label, type }) => (
                      <div className="form-group" style={{ margin: 0 }} key={field}>
                        <label style={{ fontSize: 11 }}>{label}</label>
                        {type === 'input'
                          ? <input value={vals[field]} onChange={(e) => onContentEditChange(lang, field, e.target.value)} />
                          : <textarea rows={type === 'textarea6' ? 6 : type === 'textarea3' ? 3 : 2} value={vals[field]} onChange={(e) => onContentEditChange(lang, field, e.target.value)} style={{ resize: 'vertical' }} />
                        }
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => onSaveContentEdit(lang)} disabled={isSaving}>{isSaving ? 'Opslaan...' : 'Opslaan'}</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => onCancelContentEdit(lang)} disabled={isSaving}>Annuleren</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <ContentField label="SEO Title" value={c.seoTitle} />
                      <ContentField label="SEO Description" value={c.seoDescription} />
                      <ContentField label="Google Shopping" value={c.googleShoppingDescription} />
                    </div>
                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: 12 }}>Korte beschrijving tonen</summary>
                      <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{c.description}</p>
                    </details>
                    {c.longDescription && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ cursor: 'pointer', color: '#2563eb', fontSize: 12 }}>Lange beschrijving tonen</summary>
                        <p style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{c.longDescription}</p>
                      </details>
                    )}
                    {c.translationStatus && lang !== 'nl' && (
                      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Status: {c.translationStatus}</p>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {lang === 'nl' && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => onGenerateContent(getProductType(design))} disabled={generating}>
                            {generating ? 'Genereren...' : 'Opnieuw genereren'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => onTranslateContent('de')} disabled={translating === 'de'}>
                            {translating === 'de' ? 'Vertalen...' : deContent ? '\u2192 DE opnieuw' : '\u2192 DE vertalen'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => onTranslateContent('en')} disabled={translating === 'en'}>
                            {translating === 'en' ? 'Vertalen...' : enContent ? '\u2192 EN opnieuw' : '\u2192 EN vertalen'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => onTranslateContent('fr')} disabled={translating === 'fr'}>
                            {translating === 'fr' ? 'Vertalen...' : frContent ? '\u2192 FR opnieuw' : '\u2192 FR vertalen'}
                          </button>
                        </>
                      )}
                      {lang !== 'nl' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => onTranslateContent(lang)} disabled={translating === lang}>
                          {translating === lang ? 'Vertalen...' : 'Opnieuw vertalen'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div>
                  <p style={{ color: '#9ca3af', marginBottom: 12, fontSize: 13 }}>
                    {lang === 'nl' ? 'Nog geen Nederlandse content.' : nlContent ? 'Nog niet vertaald.' : 'Genereer eerst NL content.'}
                  </p>
                  {lang === 'nl' && (
                    <button className="btn btn-success btn-sm" onClick={() => onGenerateContent(getProductType(design))} disabled={generating}>
                      {generating ? 'Genereren...' : 'NL Content genereren (AI)'}
                    </button>
                  )}
                  {lang !== 'nl' && nlContent && (
                    <button className="btn btn-secondary btn-sm" onClick={() => onTranslateContent(lang)} disabled={translating === lang}>
                      {translating === lang ? 'Vertalen...' : `Vertalen \u2192 ${lang.toUpperCase()}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
