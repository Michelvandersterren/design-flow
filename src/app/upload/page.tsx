'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const DESIGN_TYPES = ['IB', 'MC', 'SP']

const ALL_COLLECTIONS = [
  'Animal Art', 'Azure Gold', 'Botanical Bloom', 'Classic Art', 'Concrete',
  'Dolce Vita', 'Geometric Elegance', 'Granite Luxe', 'Japandi', 'Landscape',
  'Luxury Gold', 'Luxury Pink', 'Modern Marble', 'Pops of Color', 'Soft Botanical',
  'Solid Elegance', 'Vintage Flowers', 'World of Spices',
  'Bloemen', 'Schotse Hooglanders', 'Serenity Landscapes', 'Katten', 'Paarden',
  'Exotic', 'Black & White', 'Kitchen Quotes', 'Modern Abstract', 'Kitchen Pops',
]

type UploadState = 'idle' | 'analyzing' | 'ready' | 'uploading' | 'error'

interface AISuggestion {
  suggestedName: string
  suggestedCode: string
  suggestedCollections: string[]
  suggestedColors: string[]
  suggestedProductTypes: {
    inductionFriendly: boolean
    circleFriendly: boolean
    splashFriendly: boolean
  }
  styleDescription: string
  confidence: 'high' | 'medium' | 'low'
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'Hoge zekerheid',
  medium: 'Gemiddelde zekerheid',
  low: 'Lage zekerheid — controleer handmatig',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  high: '#16a34a',
  medium: '#d97706',
  low: '#dc2626',
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [state, setState] = useState<UploadState>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  // Form fields
  const [designName, setDesignName] = useState('')
  const [designCode, setDesignCode] = useState('')
  const [designType, setDesignType] = useState('IB')

  // AI suggestion state
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [selectedCollections, setSelectedCollections] = useState<string[]>([])

  const analyzeImage = async (f: File) => {
    setState('analyzing')
    setAnalyzeError(null)
    setSuggestion(null)

    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/designs/analyze-image', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok || !data.result) {
        setAnalyzeError(data.error || 'Analyse mislukt')
        setState('ready')
        return
      }

      const r: AISuggestion = data.result
      setSuggestion(r)
      setSelectedCollections(r.suggestedCollections || [])

      // Pre-fill form fields with suggestions
      setDesignName(r.suggestedName || '')
      setDesignCode(r.suggestedCode || '')

      // Pick product type from suggestion
      if (r.suggestedProductTypes?.inductionFriendly) setDesignType('IB')
      else if (r.suggestedProductTypes?.circleFriendly) setDesignType('MC')
      else if (r.suggestedProductTypes?.splashFriendly) setDesignType('SP')

      setState('ready')
    } catch {
      setAnalyzeError('Analyse mislukt — vul de velden handmatig in')
      setState('ready')
    }
  }

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setError(null)
    setPreview(URL.createObjectURL(f))
    analyzeImage(f)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
    e.target.value = ''
  }

  const handleUpload = async () => {
    if (!file || !designName || !designCode) {
      setError('Vul alle velden in en selecteer een bestand')
      return
    }

    setState('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('designName', designName)
      formData.append('designCode', designCode)
      formData.append('designType', designType)

      // Pass AI-detected collections and colors to the upload endpoint
      if (suggestion) {
        formData.append('collections', selectedCollections.join(','))
        formData.append('colorTags', suggestion.suggestedColors.join(','))
      }
      // Derive product type flags from the selected designType, not from the AI suggestion.
      // The user may have overridden the AI suggestion via the dropdown.
      formData.append('inductionFriendly', String(designType === 'IB'))
      formData.append('circleFriendly', String(designType === 'MC'))
      formData.append('splashFriendly', String(designType === 'SP'))

      const res = await fetch('/api/designs/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload mislukt')
      }

      router.push(`/designs/${data.design.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload mislukt')
      setState('error')
    }
  }

  const applySuggestion = () => {
    if (!suggestion) return
    setDesignName(suggestion.suggestedName)
    setDesignCode(suggestion.suggestedCode)
    setSelectedCollections(suggestion.suggestedCollections || [])
    if (suggestion.suggestedProductTypes?.inductionFriendly) setDesignType('IB')
    else if (suggestion.suggestedProductTypes?.circleFriendly) setDesignType('MC')
    else if (suggestion.suggestedProductTypes?.splashFriendly) setDesignType('SP')
  }

  const isFormReady = state === 'ready' || state === 'error'
  const showAnalyzing = state === 'analyzing'

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ margin: '0 0 4px' }}>Design uploaden</h1>
      <p style={{ color: '#6b7280', marginBottom: 28, fontSize: 14 }}>
        De AI analyseert je design en stelt een naam, code en collecties voor.
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? '#3b82f6' : '#d1d5db'}`,
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
          cursor: 'pointer',
          textAlign: 'center',
          background: dragOver ? '#eff6ff' : '#f9fafb',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/tiff"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
        {preview ? (
          <div>
            <img
              src={preview}
              alt="Preview"
              style={{ maxHeight: 180, maxWidth: '100%', objectFit: 'contain', borderRadius: 6, marginBottom: 10 }}
            />
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
              {file?.name} — {((file?.size || 0) / 1024 / 1024).toFixed(1)} MB
            </p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Klik om te wijzigen</p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 32, color: '#d1d5db', margin: '0 0 8px' }}>↑</p>
            <p style={{ fontWeight: 500, color: '#374151', margin: 0 }}>Sleep je design hierheen</p>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '4px 0 0' }}>of klik om te bladeren · PNG, JPG, WebP, TIFF · max 50MB</p>
          </div>
        )}
      </div>

      {/* AI analysestatus */}
      {showAnalyzing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe',
          borderRadius: 8, marginBottom: 20, fontSize: 14, color: '#1e40af',
        }}>
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          AI analyseert je design...
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* AI suggesties */}
      {suggestion && isFormReady && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 10, padding: 16, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#166534' }}>AI analyse klaar</span>
              <span style={{
                marginLeft: 8, fontSize: 11, padding: '2px 7px', borderRadius: 4,
                background: CONFIDENCE_COLOR[suggestion.confidence] + '22',
                color: CONFIDENCE_COLOR[suggestion.confidence],
              }}>
                {CONFIDENCE_LABEL[suggestion.confidence]}
              </span>
            </div>
            <button
              onClick={applySuggestion}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 6,
                border: '1px solid #86efac', background: '#dcfce7', color: '#166534',
                cursor: 'pointer',
              }}
            >
              Herstel suggesties
            </button>
          </div>

          {suggestion.styleDescription && (
            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 10px', fontStyle: 'italic' }}>
              "{suggestion.styleDescription}"
            </p>
          )}

          {/* Collectie-selectie — AI-suggestie aangevinkt, gebruiker kan aanpassen */}
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
              Collecties — AI-suggestie aangevinkt, pas aan waar nodig:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_COLLECTIONS.map((c) => {
                const checked = selectedCollections.includes(c)
                const aiSuggested = suggestion.suggestedCollections.includes(c)
                return (
                  <label
                    key={c}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      fontSize: 12, padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
                      border: `1px solid ${checked ? '#3b82f6' : '#e5e7eb'}`,
                      background: checked ? '#dbeafe' : aiSuggested ? '#f0fdf4' : '#f9fafb',
                      color: checked ? '#1e40af' : '#374151',
                      fontWeight: aiSuggested ? 600 : 400,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedCollections((prev) => [...prev, c])
                        else setSelectedCollections((prev) => prev.filter((x) => x !== c))
                      }}
                      style={{ margin: 0 }}
                    />
                    {c}
                  </label>
                )
              })}
            </div>
            {selectedCollections.length > 0 && (
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Geselecteerd: {selectedCollections.join(', ')}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestion.suggestedColors.map((c) => (
              <span key={c} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#f3f4f6', color: '#374151' }}>
                {c}
              </span>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
            Geschikt voor: &nbsp;
            {suggestion.suggestedProductTypes.inductionFriendly && <span style={{ marginRight: 8 }}>IB (Inductiebeschermer)</span>}
            {suggestion.suggestedProductTypes.circleFriendly && <span style={{ marginRight: 8 }}>MC (Muurcirkel)</span>}
            {suggestion.suggestedProductTypes.splashFriendly && <span>SP (Spatscherm)</span>}
          </div>
        </div>
      )}

      {analyzeError && (
        <div style={{
          padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a',
          borderRadius: 8, color: '#92400e', fontSize: 13, marginBottom: 16,
        }}>
          Analyse niet beschikbaar: {analyzeError}
        </div>
      )}

      {/* Formulier — toon altijd als bestand geselecteerd, ook tijdens analyse */}
      {file && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Design naam <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder={showAnalyzing ? 'Wordt ingevuld door AI...' : 'bijv. Almond Granite'}
              disabled={showAnalyzing}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
                background: showAnalyzing ? '#f9fafb' : '#fff',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Design code <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={designCode}
              onChange={(e) => setDesignCode(e.target.value.toUpperCase())}
              placeholder={showAnalyzing ? 'Wordt ingevuld door AI...' : 'bijv. ALMGR'}
              disabled={showAnalyzing}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, fontFamily: 'monospace', boxSizing: 'border-box',
                background: showAnalyzing ? '#f9fafb' : '#fff',
              }}
            />
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Korte unieke code, hoofdletters — wordt gebruikt in de SKU</p>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Product type
            </label>
            <select
              value={designType}
              onChange={(e) => setDesignType(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
                borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
              }}
            >
              {DESIGN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'IB' ? 'IB — Inductiebeschermer' : t === 'MC' ? 'MC — Muurcirkel' : 'SP — Spatscherm'}
                </option>
              ))}
            </select>
            {suggestion && (
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                AI suggestie: &nbsp;
                {suggestion.suggestedProductTypes.inductionFriendly && 'IB '}
                {suggestion.suggestedProductTypes.circleFriendly && 'MC '}
                {suggestion.suggestedProductTypes.splashFriendly && 'SP'}
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={state === 'uploading' || state === 'analyzing' || !file}
        className="btn btn-primary"
        style={{
          width: '100%', padding: '12px', fontSize: 15,
          opacity: (state === 'uploading' || state === 'analyzing' || !file) ? 0.5 : 1,
          cursor: (state === 'uploading' || state === 'analyzing' || !file) ? 'not-allowed' : 'pointer',
        }}
      >
        {state === 'uploading' ? 'Uploaden naar Google Drive...' :
          state === 'analyzing' ? 'AI analyseert design...' :
          'Design uploaden'}
      </button>
    </div>
  )
}
