'use client'

import { useEffect, useState } from 'react'

interface BrandVoice {
  companyInfo: string
  mission: string
  targetAudience: string
  partnerInfo: string
  materialIB: string
  materialMC: string
  materialSP: string
  toneOfVoice: string
  doUse: string
  doNotUse: string
  seoKeywordsIB: string
  seoKeywordsMC: string
  seoKeywordsSP: string
  exampleDescriptionIB: string
  exampleDescriptionMC: string
  exampleDescriptionSP: string
  faq: string
}

const EMPTY: BrandVoice = {
  companyInfo: '',
  mission: '',
  targetAudience: '',
  partnerInfo: '',
  materialIB: '',
  materialMC: '',
  materialSP: '',
  toneOfVoice: '',
  doUse: '',
  doNotUse: '',
  seoKeywordsIB: '',
  seoKeywordsMC: '',
  seoKeywordsSP: '',
  exampleDescriptionIB: '',
  exampleDescriptionMC: '',
  exampleDescriptionSP: '',
  faq: '[]',
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

  useEffect(() => {
    fetch('/api/brand-voice')
      .then((r) => r.json())
      .then((json) => {
        if (json.brandVoice) {
          const bv = json.brandVoice
          setData({
            companyInfo: bv.companyInfo || '',
            mission: bv.mission || '',
            targetAudience: bv.targetAudience || '',
            partnerInfo: bv.partnerInfo || '',
            materialIB: bv.materialIB || '',
            materialMC: bv.materialMC || '',
            materialSP: bv.materialSP || '',
            toneOfVoice: bv.toneOfVoice || '',
            doUse: bv.doUse || '',
            doNotUse: bv.doNotUse || '',
            seoKeywordsIB: bv.seoKeywordsIB || '',
            seoKeywordsMC: bv.seoKeywordsMC || '',
            seoKeywordsSP: bv.seoKeywordsSP || '',
            exampleDescriptionIB: bv.exampleDescriptionIB || '',
            exampleDescriptionMC: bv.exampleDescriptionMC || '',
            exampleDescriptionSP: bv.exampleDescriptionSP || '',
            faq: bv.faq || '[]',
          })
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
                  Kommagescheiden lijst van woorden die de AI moet vermijden
                </p>
                {textarea('doNotUse', 2, 'goedkoop, simpel, standaard, gewoon...')}
              </div>
            </div>
          )}

          {activeSection === 'seo' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>SEO Keywords</h2>
              <div className="form-group">
                <label>Keywords — Inductiebeschermer (IB)</label>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
                  Kommagescheiden zoekwoorden voor IB-producten
                </p>
                {textarea('seoKeywordsIB', 3, 'inductiebeschermer, kookplaat beschermer...')}
              </div>
              <div className="form-group">
                <label>Keywords — Muurcirkel (MC)</label>
                {textarea('seoKeywordsMC', 3, 'muurcirkel, wandcirkel...')}
              </div>
              <div className="form-group">
                <label>Keywords — Spatscherm (SP)</label>
                {textarea('seoKeywordsSP', 3, 'spatscherm keuken, aluminium spatscherm...')}
              </div>
            </div>
          )}

          {activeSection === 'voorbeelden' && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Voorbeeldteksten voor AI</h2>
              <p style={{ color: '#6b7280', fontSize: 14, marginTop: -4, marginBottom: 20 }}>
                Deze teksten worden als referentie aan de AI meegegeven. Gebruik <code>[design naam]</code> als placeholder.
              </p>
              <div className="form-group">
                <label>Voorbeeld productbeschrijving — Inductiebeschermer</label>
                {textarea('exampleDescriptionIB', 8)}
              </div>
              <div className="form-group">
                <label>Voorbeeld productbeschrijving — Muurcirkel</label>
                {textarea('exampleDescriptionMC', 8)}
              </div>
              <div className="form-group">
                <label>Voorbeeld productbeschrijving — Spatscherm</label>
                {textarea('exampleDescriptionSP', 8)}
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
