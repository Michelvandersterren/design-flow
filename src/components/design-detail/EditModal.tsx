import React from 'react'

interface EditForm {
  designName: string
  designType: string
  styleFamily: string
  collections: string
  colorTags: string
  inductionFriendly: boolean
  circleFriendly: boolean
  splashFriendly: boolean
}

interface EditModalProps {
  editForm: EditForm
  saving: boolean
  onClose: () => void
  onSave: () => void
  onFormChange: (form: EditForm) => void
}

export function EditModal({ editForm, saving, onClose, onSave, onFormChange }: EditModalProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', margin: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0 }}>Design bewerken</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280' }}>{'\u00D7'}</button>
        </div>
        <div className="form-group">
          <label>Naam</label>
          <input value={editForm.designName} onChange={(e) => onFormChange({ ...editForm, designName: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Stijlfamilie</label>
          <input value={editForm.styleFamily} onChange={(e) => onFormChange({ ...editForm, styleFamily: e.target.value })} placeholder="bijv. Modern, Botanisch" />
        </div>
        <div className="form-group">
          <label>Collecties (komma-gescheiden)</label>
          <input value={editForm.collections} onChange={(e) => onFormChange({ ...editForm, collections: e.target.value })} placeholder="bijv. Lente, Natuur" />
        </div>
        <div className="form-group">
          <label>Kleurtags (komma-gescheiden)</label>
          <input value={editForm.colorTags} onChange={(e) => onFormChange({ ...editForm, colorTags: e.target.value })} placeholder="bijv. Groen, Blauw" />
        </div>
        <div className="form-group">
          <label>Producttypes</label>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {[
              { key: 'inductionFriendly', label: 'Inductiebeschermer' },
              { key: 'circleFriendly', label: 'Muurcirkel' },
              { key: 'splashFriendly', label: 'Spatscherm' },
            ].map(({ key, label }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={editForm[key as keyof EditForm] as boolean}
                  onChange={(e) => onFormChange({ ...editForm, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Opslaan...' : 'Opslaan'}</button>
          <button className="btn btn-secondary" onClick={onClose}>Annuleren</button>
        </div>
      </div>
    </div>
  )
}
