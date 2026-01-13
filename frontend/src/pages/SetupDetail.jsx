import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { setups, auth } from '../services/api'
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
  const [currentUserId, setCurrentUserId] = useState(null)
  const [isShared, setIsShared] = useState(false)
  const [sharedFullAccess, setSharedFullAccess] = useState(false)

  useEffect(() => {
    loadSetup()
    loadCurrentUser()
  }, [id])

  const loadCurrentUser = async () => {
    try {
      const response = await auth.me()
      setCurrentUserId(response.data.id)
    } catch (error) {
      console.error('Failed to load current user:', error)
    }
  }

  const loadSetup = async () => {
    try {
      const response = await setups.getOne(id)
      setSetup(response.data)
      setRating(response.data.rating)
      setNotes(response.data.notes || '')
      setIsShared(response.data.is_shared || false)
      setSharedFullAccess(response.data.shared_full_access || false)
    } catch (error) {
      console.error('Failed to load setup:', error)
    } finally {
      setLoading(false)
    }
  }

  // Determine if current user is the owner
  const isOwner = currentUserId && setup && setup.user_id === currentUserId
  // Can edit if owner OR if shared with full access
  const canEdit = isOwner || (setup?.is_shared && setup?.shared_full_access)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updateData = { rating, notes }
      // Only include sharing settings if owner
      if (isOwner) {
        updateData.is_shared = isShared
        updateData.shared_full_access = sharedFullAccess
      }
      await setups.update(id, updateData)
      alert('Setup updated successfully')
      loadSetup()
    } catch (error) {
      alert('Failed to update setup: ' + (error.response?.data?.detail || error.message))
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
          <div>
            <h1>{setup.event_name || 'Unnamed Event'}</h1>
            {setup.owner_name && (
              <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                Shared by: {setup.owner_name}
              </p>
            )}
          </div>
          {isOwner && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-info" onClick={handleRefresh} disabled={refreshing}>
                Refresh with Claude
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Shared setup banner for non-owners */}
        {!isOwner && setup.owner_name && (
          <div className="shared-banner">
            <span className="shared-icon">&#128279;</span>
            <span>
              This is a shared setup. {setup.shared_full_access ? 'You can edit it.' : 'View only.'}
            </span>
          </div>
        )}

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
                  onClick={() => canEdit && setRating(star)}
                  disabled={!canEdit}
                  style={{
                    fontSize: '2rem',
                    background: 'none',
                    border: 'none',
                    cursor: canEdit ? 'pointer' : 'default',
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
              disabled={!canEdit}
            />
          </div>

          {canEdit && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Rating & Notes'}
            </button>
          )}
        </div>

        {/* Sharing Settings - Only for owners */}
        {isOwner && (
          <div className="card">
            <h2 className="card-header">Sharing Settings</h2>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={(e) => setIsShared(e.target.checked)}
                />
                <span>Share this setup with other users</span>
              </label>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 1.5rem' }}>
                When enabled, other users can view this setup
              </p>
            </div>

            {isShared && (
              <div className="form-group" style={{ marginLeft: '1.5rem' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={sharedFullAccess}
                    onChange={(e) => setSharedFullAccess(e.target.checked)}
                  />
                  <span>Allow full access (edit)</span>
                </label>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 1.5rem' }}>
                  If unchecked, others can only view (read-only)
                </p>
              </div>
            )}

            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Sharing Settings'}
            </button>
          </div>
        )}
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

        /* Shared banner styles */
        .shared-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border: 1px solid #3b82f6;
          border-radius: 0.5rem;
          margin-bottom: 1rem;
          color: #1e40af;
          font-size: 0.9rem;
        }

        .shared-icon {
          font-size: 1.1rem;
        }

        /* Checkbox label styles */
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          font-weight: 500;
        }

        .checkbox-label input[type="checkbox"] {
          width: 1.1rem;
          height: 1.1rem;
          cursor: pointer;
        }
      `}</style>
    </>
  )
}

export default SetupDetail
