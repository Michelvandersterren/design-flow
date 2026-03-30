'use client'

import { useEffect, useState } from 'react'

const LANGUAGES = ['nl', 'de', 'en', 'fr'] as const
type Lang = typeof LANGUAGES[number]

const LANG_LABELS: Record<Lang, string> = {
  nl: 'NL',
  de: 'DE',
  en: 'EN',
  fr: 'FR',
}

// All fields in the BrandVoice model (matches Prisma schema)
interface BrandVoice {
  // Universal
  companyInfo: string
  mission: string
  targetAudience: string
  partnerInfo: string
  materialIB: string
  materialMC: string
  materialSP: string
  toneOfVoice: string
  doUse: string
  faq: string

  // Per-language: doNotUse
  doNotUse_nl: string
  doNotUse_de: string
  doNotUse_en: string
  doNotUse_fr: string

  // Per-language: SEO keywords
  seoKeywordsIB_nl: string
  seoKeywordsIB_de: string
  seoKeywordsIB_en: string
  seoKeywordsIB_fr: string
  seoKeywordsMC_nl: string
  seoKeywordsMC_de: string
  seoKeywordsMC_en: string
  seoKeywordsMC_fr: string
  seoKeywordsSP_nl: string
  seoKeywordsSP_de: string
  seoKeywordsSP_en: string
  seoKeywordsSP_fr: string

  // Per-language: example descriptions
  exampleDescriptionIB_nl: string
  exampleDescriptionIB_de: string
  exampleDescriptionIB_en: string
  exampleDescriptionIB_fr: string
  exampleDescriptionMC_nl: string
  exampleDescriptionMC_de: string
  exampleDescriptionMC_en: string
  exampleDescriptionMC_fr: string
  exampleDescriptionSP_nl: string
  exampleDescriptionSP_de: string
  exampleDescriptionSP_en: string
  exampleDescriptionSP_fr: string
}

const EMPTY: BrandVoice = {
  companyInfo: '', mission: '', targetAudience: '', partnerInfo: '',
  materialIB: '', materialMC: '', materialSP: '',
  toneOfVoice: '', doUse: '', faq: '[]',
  doNotUse_nl: '', doNotUse_de: '', doNotUse_en: '', doNotUse_fr: '',
  seoKeywordsIB_nl: '', seoKeywordsIB_de: '', seoKeywordsIB_en: '', seoKeywordsIB_fr: '',
  seoKeywordsMC_nl: '', seoKeywordsMC_de: '', seoKeywordsMC_en: '', seoKeywordsMC_fr: '',
  seoKeywordsSP_nl: '', seoKeywordsSP_de: '', seoKeywordsSP_en: '', seoKeywordsSP_fr: '',
  exampleDescriptionIB_nl: '', exampleDescriptionIB_de: '', exampleDescriptionIB_en: '', exampleDescriptionIB_fr: '',
  exampleDescriptionMC_nl: '', exampleDescriptionMC_de: '', exampleDescriptionMC_en: '', exampleDescriptionMC_fr: '',
  exampleDescriptionSP_nl: '', exampleDescriptionSP_de: '', exampleDescriptionSP_en: '', exampleDescriptionSP_fr: '',
}

type Section = 'bedrijf' | 'materialen' | 'tone' | 'seo' | 'voorbeelden' | 'faq'

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'bedrijf', label: 'Bedrijfsinformatie' },
  { key: 'materialen', label: 'Materialen & Partner' },
  { key: 'tone', label: 'Tone of Voice' },
  { key: 'seo', label: 'SEO Keywords' },
  { key: 'voorbeelden', label: 'Voorbeeldteksten' },
  { key: 'faq', label: 'FAQ' },
]

export default function BrandVoicePage() {
  const [data, setData] = useState<BrandVoice>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('bedrijf')
  const [activeLang, setActiveLang] = useState<Lang>('nl')

  useEffect(() => {
    fetch('/api/brand-voice')
      .then((r) => r.json())
      .then((json) => {
        if (json.brandVoice) {
          const bv = json.brandVoice
          const loaded: Record<string, string> = {}
          for (const key of Object.keys(EMPTY)) {
            loaded[key] = bv[key] || (key === 'faq' ? '[]' : '')
          }
          setData(loaded as unknown as BrandVoice)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof BrandVoice, value: string) => {
    setData((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/brand-voice', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) setSaved(true)
      else alert('Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  // FAQ helpers
  let faqItems: { q: string; a: string }[] = []
  try {
    faqItems = JSON.parse(data.faq || '[]')
  } catch {
    faqItems = []
  }

  const setFaq = (items: { q: string; a: string }[]) => {
    set('faq', JSON.stringify(items))
  }

  const addFaqItem = () => setFaq([...faqItems, { q: '', a: '' }])
  const removeFaqItem = (i: number) => setFaq(faqItems.filter((_, idx) => idx !== i))
  const updateFaqItem = (i: number, field: 'q' | 'a', value: string) => {
    const updated = faqItems.map((item, idx) => (idx === i ? { ...item, [field]: value } : item))
    setFaq(updated)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#666' }}>
        Laden...
      </div>
    )
  }

  const textarea = (key: keyof BrandVoice, rows = 4, placeholder = '') => (
    <textarea
      rows={rows}
      placeholder={placeholder}
      value={data[key]}
      onChange={(e) => set(key, e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        fontSize: 14,
        fontFamily: 'inherit',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  )

  // Helper: build a field key with language suffix
  const langKey = (base: string, lang: Lang): keyof BrandVoice =>
    `${base}_${lang}` as keyof BrandVoice

  // Check if a language variant has content
  const hasContent = (base: string, lang: Lang): boolean => {
    const val = data[langKey(base, lang)]
    return Boolean(val && val.trim())
  }

  // Language tab bar component for sections with per-language fields
  const langTabs = () => (
    <div style={{
      display: 'flex',
      gap: 0,
      borderBottom: '2px solid #e5e7eb',
      marginBottom: 20,
    }}>
      {LANGUAGES.map((lang) => {
        const isActive = activeLang === lang
        // Check if this language has any content in the current section
        let fieldsForSection: string[] = []
        if (activeSection === 'tone') fieldsForSection = ['doNotUse']
        else if (activeSection === 'seo') fieldsForSection = ['seoKeywordsIB', 'seoKeywordsMC', 'seoKeywordsSP']
        else if (activeSection === 'voorbeelden') fieldsForSection = ['exampleDescriptionIB', 'exampleDescriptionMC', 'exampleDescriptionSP']

        const langHasContent = fieldsForSection.some((f) => hasContent(f, lang))

        return (
          <button
            key={lang}
            onClick={() => setActiveLang(lang)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderBottom: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
              marginBottom: -2,
              background: 'transparent',
              color: isActive ? '#1d4ed8' : '#6b7280',
              fontWeight: isActive ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {LANG_LABELS[lang]}
            {!langHasContent && lang !== 'nl' && (
              <span style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#fbbf24',
                marginLeft: 6,
                verticalAlign: 'middle',
              }} title="Nog niet ingevuld" />
            )}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: 0 }}>Brand Voice</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              Dit document wordt gebruikt door de AI bij het genereren van productcontent.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {saved && <span style={{ color: '#16a34a', fontSize: 14 }}>Opgeslagen</span>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Sidebar nav */}
        <nav
          style={{
            minWidth: 180,
            position: 'sticky',
            top: 20,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '8px 0',
          }}
        >
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                border: 'none',
                background: activeSection === s.key ? '#eff6ff' : 'transparent',
                color: activeSection === s.key ? '#1d4ed8' : '#374151',
                fontWeight: activeSection === s.key ? 600 : 400,
                fontSize: 14,
                cursor: 'pointer',
                borderLeft: activeSection === s.key ? '3px solid #1d4ed8' : '3px solid transparent',
              }}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div style={{ flex: 1 }}>

          {activeSection === 'bedrijf' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Bedrijfsinformatie</h2>
              <div className="form-group">
                <label>Over KitchenArt</label>
                {textarea('companyInfo', 4, 'Wie is KitchenArt, wat doen ze, locatie...')}
              </div>
              <div className="form-group">
                <label>Missie & Visie</label>
                {textarea('mission', 3, 'Wat is de missie van KitchenArt?')}
              </div>
              <div className="form-group">
                <label>Doelgroep</label>
                {textarea('targetAudience', 3, 'Wie zijn de klanten van KitchenArt?')}
              </div>
            </div>
          )}

          {activeSection === 'materialen' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Materialen & Productiepartner</h2>
              <div className="form-group">
                <label>Productiepartner (Probo)</label>
                {textarea('partnerInfo', 3, 'Info over Probo, levertijden, productiewijze...')}
              </div>
              <div className="form-group">
                <label>Materiaal — Inductiebeschermer (IB)</label>
                {textarea('materialIB', 4, 'Vinyl specs, eigenschappen, verzorging...')}
              </div>
              <div className="form-group">
                <label>Materiaal — Muurcirkel (MC)</label>
                {textarea('materialMC', 4, 'Dibond varianten, Forex, Multiplex...')}
              </div>
              <div className="form-group">
                <label>Materiaal — Spatscherm (SP)</label>
                {textarea('materialSP', 3, 'Aluminium Dibond specs...')}
              </div>
            </div>
          )}

          {activeSection === 'tone' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Tone of Voice</h2>
              <div className="form-group">
                <label>Schrijfstijl & toon</label>
                {textarea('toneOfVoice', 5, 'Beschrijf de schrijfstijl: warm, toegankelijk, zelfverzekerd...')}
              </div>
              <div className="form-group">
                <label>Gebruik WEL (woorden/uitdrukkingen)</label>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
                  Kommagescheiden lijst van woorden of zinsdelen die de AI moet gebruiken
                </p>
                {textarea('doUse', 3, 'stijlvol, premium, uniek, eyecatcher...')}
              </div>

              <div className="form-group">
                <label>Gebruik NIET (vermijden)</label>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
                  Per taal de woorden die de AI moet vermijden. De quality checker gebruikt deze lijst ook.
                </p>
                {langTabs()}
                {textarea(langKey('doNotUse', activeLang), 2,
                  activeLang === 'nl' ? 'goedkoop, simpel, standaard, gewoon...'
                    : activeLang === 'de' ? 'billig, einfach, standard, normal...'
                      : activeLang === 'en' ? 'cheap, simple, standard, basic...'
                        : 'bon march\u00e9, simple, standard, basique...'
                )}
              </div>
            </div>
          )}

          {activeSection === 'seo' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>SEO Keywords</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginTop: -4, marginBottom: 16 }}>
                Zoekwoorden per taal en producttype. De AI gebruikt deze bij het schrijven van SEO titels en beschrijvingen.
              </p>
              {langTabs()}

              <div className="form-group">
                <label>Keywords — Inductiebeschermer (IB)</label>
                {textarea(langKey('seoKeywordsIB', activeLang), 3,
                  activeLang === 'nl' ? 'inductiebeschermer, kookplaat beschermer...'
                    : activeLang === 'de' ? 'Induktionsschutz, Herdabdeckplatte...'
                      : activeLang === 'en' ? 'induction protector, hob cover...'
                        : 'protecteur induction, plaque de protection...'
                )}
              </div>
              <div className="form-group">
                <label>Keywords — Muurcirkel (MC)</label>
                {textarea(langKey('seoKeywordsMC', activeLang), 3,
                  activeLang === 'nl' ? 'muurcirkel, wandcirkel...'
                    : activeLang === 'de' ? 'Wandkreis, runde Wanddekoration...'
                      : activeLang === 'en' ? 'wall circle, round wall art...'
                        : 'cercle mural, d\u00e9coration murale ronde...'
                )}
              </div>
              <div className="form-group">
                <label>Keywords — Spatscherm (SP)</label>
                {textarea(langKey('seoKeywordsSP', activeLang), 3,
                  activeLang === 'nl' ? 'spatscherm keuken, aluminium spatscherm...'
                    : activeLang === 'de' ? 'Spritzschutz K\u00fcche, Aluminium Spritzschutz...'
                      : activeLang === 'en' ? 'kitchen splashback, aluminium splashback...'
                        : '\u00e9cran anti-\u00e9claboussures, cr\u00e9dence cuisine...'
                )}
              </div>
            </div>
          )}

          {activeSection === 'voorbeelden' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Voorbeeldteksten voor AI</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginTop: -4, marginBottom: 16 }}>
                Per taal een voorbeeldtekst die de AI als referentie gebruikt. Gebruik <code>[design naam]</code> als placeholder.
                Lege taalvarianten vallen terug op de Nederlandse tekst.
              </p>
              {langTabs()}

              <div className="form-group">
                <label>Voorbeeld productbeschrijving — Inductiebeschermer</label>
                {textarea(langKey('exampleDescriptionIB', activeLang), 8)}
              </div>
              <div className="form-group">
                <label>Voorbeeld productbeschrijving — Muurcirkel</label>
                {textarea(langKey('exampleDescriptionMC', activeLang), 8)}
              </div>
              <div className="form-group">
                <label>Voorbeeld productbeschrijving — Spatscherm</label>
                {textarea(langKey('exampleDescriptionSP', activeLang), 8)}
              </div>
            </div>
          )}

          {activeSection === 'faq' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>FAQ</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginTop: -4, marginBottom: 20 }}>
                Veelgestelde vragen worden door de AI gebruikt als referentie voor productcontent.
              </p>

              {faqItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>Vraag {i + 1}</span>
                    <button
                      onClick={() => removeFaqItem(i)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#ef4444',
                        fontSize: 18,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 12 }}>Vraag</label>
                    <input
                      type="text"
                      value={item.q}
                      onChange={(e) => updateFaqItem(i, 'q', e.target.value)}
                      placeholder="Wat wil de klant weten?"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 12 }}>Antwoord</label>
                    <textarea
                      rows={3}
                      value={item.a}
                      onChange={(e) => updateFaqItem(i, 'a', e.target.value)}
                      placeholder="Het antwoord..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                        fontSize: 14,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              ))}

              <button className="btn btn-secondary" onClick={addFaqItem} style={{ marginTop: 4 }}>
                + Vraag toevoegen
              </button>
            </div>
          )}

          {/* Bottom save */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            {saved && <span style={{ color: '#16a34a', fontSize: 14, alignSelf: 'center' }}>Opgeslagen</span>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
