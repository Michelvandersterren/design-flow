'use client'

import { useEffect, useState } from 'react'

interface Design {
  id: string
  designCode: string
  designName: string
  status: string
  inductionFriendly: boolean
  circleFriendly: boolean
  splashFriendly: boolean
  collections: string | null
  variants: any[]
  content: any[]
  workflowSteps: any[]
  updatedAt: string
}

interface Stats {
  total: number
  draft: number
  review: number
  approved: number
  live: number
}

export default function Dashboard() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, draft: 0, review: 0, approved: 0, live: 0 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const fetchDesigns = async () => {
    try {
      const res = await fetch('/api/designs')
      const data = await res.json()
      setDesigns(data.designs || [])
      
      const counts = {
        total: data.designs?.length || 0,
        draft: data.designs?.filter((d: Design) => d.status === 'DRAFT').length || 0,
        review: data.designs?.filter((d: Design) => d.status === 'REVIEW').length || 0,
        approved: data.designs?.filter((d: Design) => d.status === 'APPROVED').length || 0,
        live: data.designs?.filter((d: Design) => d.status === 'LIVE').length || 0,
      }
      setStats(counts)
    } catch (error) {
      console.error('Error fetching designs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDesigns()
  }, [])

  const syncFromNotion = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all' })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Sync completed: ${data.synced} designs`)
        fetchDesigns()
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'badge-draft'
      case 'REVIEW': return 'badge-review'
      case 'APPROVED': return 'badge-approved'
      case 'LIVE': return 'badge-live'
      case 'FAILED': return 'badge-failed'
      default: return ''
    }
  }

  const getStepStatusClass = (step: any) => {
    switch (step.status) {
      case 'COMPLETED': return 'completed'
      case 'IN_PROGRESS': return 'in-progress'
      case 'FAILED': return 'failed'
      default: return 'pending'
    }
  }

  const filteredDesigns = designs.filter((design) => {
    const matchesSearch = !searchTerm || 
      design.designName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      design.designCode.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || design.status === filterStatus
    return matchesSearch && matchesStatus
  })

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <div className="container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Design Flow</h1>
          <button 
            className="btn btn-primary" 
            onClick={syncFromNotion}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync from Notion'}
          </button>
        </div>
      </header>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Totaal</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.draft}</div>
            <div className="stat-label">Draft</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.review}</div>
            <div className="stat-label">In Review</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.approved}</div>
            <div className="stat-label">Approved</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.live}</div>
            <div className="stat-label">Live</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <input
              type="text"
              placeholder="Search designs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '10px', borderRadius: 6, border: '1px solid #e5e7eb' }}
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">Review</option>
            <option value="APPROVED">Approved</option>
            <option value="LIVE">Live</option>
          </select>
        </div>
      </div>

      <div className="design-grid">
        {filteredDesigns.map((design) => (
          <div key={design.id} className="design-card">
            <div className="design-name">{design.designName}</div>
            <div className="design-code">{design.designCode}</div>
            
            <div style={{ marginBottom: 10 }}>
              <span className={`badge ${getStatusBadgeClass(design.status)}`}>
                {design.status}
              </span>
            </div>
            
            <div className="design-meta">
              {design.inductionFriendly && <span className="badge badge-draft">IB</span>}
              {design.circleFriendly && <span className="badge badge-draft">MC</span>}
              {design.splashFriendly && <span className="badge badge-draft">SP</span>}
            </div>
            
            {design.workflowSteps && design.workflowSteps.length > 0 && (
              <div className="workflow-steps" style={{ marginBottom: 15 }}>
                {design.workflowSteps.slice(0, 4).map((step) => (
                  <span key={step.id} className={`step ${getStepStatusClass(step)}`}>
                    {step.step.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
            
            <div className="design-actions">
              <a href={`/designs/${design.id}`} className="btn btn-primary btn-sm">
                Manage
              </a>
              <button 
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  const res = await fetch(`/api/notion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'sync_single', designCode: design.designCode })
                  })
                  const data = await res.json()
                  if (data.success) {
                    alert('Design synced from Notion')
                    fetchDesigns()
                  }
                }}
              >
                Sync
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredDesigns.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#666', marginBottom: 20 }}>
            {designs.length === 0 
              ? 'No designs found. Click "Sync from Notion" to import your design library.'
              : 'No designs match your search criteria.'}
          </p>
        </div>
      )}
    </div>
  )
}
