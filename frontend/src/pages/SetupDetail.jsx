import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { setups } from '../services/api'
import Navigation from '../components/Navigation'

function SetupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [setup, setSetup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMessage, setRefreshMessage] = useState('')

  useEffect(() => {
    loadSetup()
  }, [id])

  const loadSetup = async () => {
    try {
      const response = await setups.getOne(id)
      setSetup(response.data)
      setRating(response.data.rating)
      setNotes(response.data.notes || '')
    } catch (error) {
      console.error('Failed to load setup:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setups.update(id, { rating, notes })
      alert('Setup updated successfully')
      loadSetup()
    } catch (error) {
      alert('Failed to update setup')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (confirm('Delete this setup?')) {
      try {
        await setups.delete(id)
        navigate('/history')
      } catch (error) {
        alert('Failed to delete setup')
      }
    }
  }

  const handleRefresh = async () => {
    if (!confirm('Regenerate this setup with Claude using the latest knowledge base and learnings? This will overwrite the current instructions and settings.')) {
      return
    }

    setRefreshing(true)
    setRefreshMessage('Preparing to refresh...')

    try {
      // Update messages to show progress
      const messageTimer1 = setTimeout(() => {
        setRefreshMessage('Gathering latest learnings from your rated setups...')
      }, 2000)

      const messageTimer2 = setTimeout(() => {
        setRefreshMessage('Claude is regenerating your setup...')
      }, 5000)

      const messageTimer3 = setTimeout(() => {
        setRefreshMessage('Almost there... building updated instructions...')
      }, 15000)

      const response = await setups.refresh(id)

      clearTimeout(messageTimer1)
      clearTimeout(messageTimer2)
      clearTimeout(messageTimer3)

      setSetup(response.data)
      setRating(response.data.rating)
      setNotes(response.data.notes || '')
      alert('Setup refreshed successfully with latest knowledge!')
    } catch (error) {
      alert('Failed to refresh setup: ' + (error.response?.data?.detail || error.message))
    } finally {
      setRefreshing(false)
      setRefreshMessage('')
    }
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!setup) {
    return <div className="container">Setup not found</div>
  }

  return (
    <>
      <Navigation />
      <div className="container">
        {/* Refresh Loading Overlay */}
        {refreshing && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p className="loading-message">{refreshMessage}</p>
              <p className="loading-tip">This typically takes 15-45 seconds</p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1>{setup.event_name || 'Unnamed Event'}</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-info" onClick={handleRefresh} disabled={refreshing}>
              Refresh with Claude
            </button>
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>

        {setup.event_date && (
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Date: {new Date(setup.event_date).toLocaleDateString()}
          </p>
        )}

        <div className="card">
          <h2 className="card-header">Performers</h2>
          <ul>
            {setup.performers.map((p, i) => (
              <li key={i}>
                {p.count}x {p.type} {p.notes && `- ${p.notes}`}
              </li>
            ))}
          </ul>
        </div>

        {setup.instructions && (
          <div className="card">
            <h2 className="card-header">Setup Instructions</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{setup.instructions}</pre>
          </div>
        )}

        {setup.channel_config && Object.keys(setup.channel_config).length > 0 && (
          <div className="card">
            <h2 className="card-header">Channel Configuration</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
              {JSON.stringify(setup.channel_config, null, 2)}
            </pre>
          </div>
        )}

        {setup.eq_settings && Object.keys(setup.eq_settings).length > 0 && (
          <div className="card">
            <h2 className="card-header">EQ Settings</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
              {JSON.stringify(setup.eq_settings, null, 2)}
            </pre>
          </div>
        )}

        {setup.fx_settings && Object.keys(setup.fx_settings).length > 0 && (
          <div className="card">
            <h2 className="card-header">FX Settings</h2>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
              {JSON.stringify(setup.fx_settings, null, 2)}
            </pre>
          </div>
        )}

        <div className="card">
          <h2 className="card-header">Rating & Notes</h2>

          <div className="form-group">
            <label className="form-label">How well did this setup work? (1-5 stars)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  style={{
                    fontSize: '2rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: rating && star <= rating ? 1 : 0.3
                  }}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked well? What didn't? Any adjustments you made?"
            />
          </div>

          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Rating & Notes'}
          </button>
        </div>
      </div>

      <style>{`
        .btn-info {
          background: #3b82f6;
          color: white;
          border: none;
        }
        .btn-info:hover {
          background: #2563eb;
        }
        .btn-info:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }

        /* Loading Overlay Styles */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .loading-content {
          background: #ffffff;
          padding: 2.5rem 3rem;
          border-radius: 1rem;
          text-align: center;
          max-width: 90%;
          min-width: 320px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          border: 1px solid #e5e7eb;
        }

        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 4px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1.5rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .loading-message {
          font-size: 1.1rem;
          color: #1f2937;
          margin-bottom: 0.75rem;
          min-height: 1.5em;
          font-weight: 500;
        }

        .loading-tip {
          font-size: 0.85rem;
          color: #6b7280;
          margin: 0;
        }
      `}</style>
    </>
  )
}

export default SetupDetail
