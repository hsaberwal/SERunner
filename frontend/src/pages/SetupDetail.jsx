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
  const [corrections, setCorrections] = useState({})
  const [showCorrectionsForm, setShowCorrectionsForm] = useState(false)
  const [activeChannel, setActiveChannel] = useState(null)

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
      setCorrections(response.data.corrections || {})
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
      const updateData = { rating, notes, corrections }
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

  // Correction handlers
  const addCorrection = (channelNum) => {
    const channelConfig = setup.channel_config?.[channelNum] || {}
    setCorrections(prev => ({
      ...prev,
      [channelNum]: {
        instrument: channelConfig.instrument || '',
        mic: channelConfig.mic || '',
        eq_changes: {},
        compression_changes: {},
        fx_changes: {},
        gain_change: '',
        notes: ''
      }
    }))
    setActiveChannel(channelNum)
    setShowCorrectionsForm(true)
  }

  const updateCorrection = (channelNum, field, value) => {
    setCorrections(prev => ({
      ...prev,
      [channelNum]: {
        ...prev[channelNum],
        [field]: value
      }
    }))
  }

  const updateEqChange = (channelNum, band, value) => {
    setCorrections(prev => ({
      ...prev,
      [channelNum]: {
        ...prev[channelNum],
        eq_changes: {
          ...prev[channelNum]?.eq_changes,
          [band]: value
        }
      }
    }))
  }

  const removeCorrection = (channelNum) => {
    setCorrections(prev => {
      const newCorrections = { ...prev }
      delete newCorrections[channelNum]
      return newCorrections
    })
    if (activeChannel === channelNum) {
      setActiveChannel(null)
      setShowCorrectionsForm(false)
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

        {/* Corrections Section - For Learning */}
        <div className="card corrections-card">
          <h2 className="card-header">
            📝 Record Corrections
            <span className="header-subtitle">Help the system learn from your adjustments</span>
          </h2>
          
          <p className="corrections-intro">
            Did you make changes during the event? Record them here so future setups at this venue 
            will start with the corrected values. This is how the system learns!
          </p>

          {/* Show existing corrections */}
          {Object.keys(corrections).length > 0 && (
            <div className="existing-corrections">
              <h4>Recorded Corrections:</h4>
              {Object.entries(corrections).map(([channel, correction]) => (
                <div key={channel} className="correction-item">
                  <div className="correction-header">
                    <strong>Channel {channel}</strong>
                    {correction.instrument && <span className="correction-instrument">{correction.instrument}</span>}
                    {canEdit && (
                      <button 
                        className="btn-remove" 
                        onClick={() => removeCorrection(channel)}
                        title="Remove correction"
                      >×</button>
                    )}
                  </div>
                  <div className="correction-details">
                    {correction.eq_changes && Object.keys(correction.eq_changes).length > 0 && (
                      <div><strong>EQ:</strong> {JSON.stringify(correction.eq_changes)}</div>
                    )}
                    {correction.compression_changes && Object.keys(correction.compression_changes).length > 0 && (
                      <div><strong>Compression:</strong> {JSON.stringify(correction.compression_changes)}</div>
                    )}
                    {correction.gain_change && (
                      <div><strong>Gain:</strong> {correction.gain_change}</div>
                    )}
                    {correction.notes && (
                      <div><strong>Notes:</strong> {correction.notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Channel selection for adding corrections */}
          {canEdit && setup.channel_config && Object.keys(setup.channel_config).length > 0 && (
            <div className="add-correction-section">
              <h4>Add Correction for Channel:</h4>
              <div className="channel-buttons">
                {Object.entries(setup.channel_config).map(([channelNum, config]) => (
                  <button
                    key={channelNum}
                    className={`channel-btn ${corrections[channelNum] ? 'has-correction' : ''} ${activeChannel === channelNum ? 'active' : ''}`}
                    onClick={() => corrections[channelNum] ? setActiveChannel(channelNum) : addCorrection(channelNum)}
                  >
                    <span className="channel-num">Ch {channelNum}</span>
                    <span className="channel-name">{config.instrument || 'Unknown'}</span>
                    {corrections[channelNum] && <span className="correction-badge">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Correction form for active channel */}
          {showCorrectionsForm && activeChannel && corrections[activeChannel] && canEdit && (
            <div className="correction-form">
              <h4>
                Corrections for Channel {activeChannel}: {corrections[activeChannel]?.instrument || setup.channel_config?.[activeChannel]?.instrument || 'Unknown'}
              </h4>
              
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">HPF Change</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., 80Hz → 120Hz"
                    value={corrections[activeChannel]?.eq_changes?.hpf || ''}
                    onChange={(e) => updateEqChange(activeChannel, 'hpf', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gain Change</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., +3dB or -2dB"
                    value={corrections[activeChannel]?.gain_change || ''}
                    onChange={(e) => updateCorrection(activeChannel, 'gain_change', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Band 1 (Low) Change</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., 250Hz: +2dB → -2dB"
                    value={corrections[activeChannel]?.eq_changes?.band1 || ''}
                    onChange={(e) => updateEqChange(activeChannel, 'band1', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Band 2 (Low-Mid) Change</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., 500Hz: flat → -3dB"
                    value={corrections[activeChannel]?.eq_changes?.band2 || ''}
                    onChange={(e) => updateEqChange(activeChannel, 'band2', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Band 3 (High-Mid) Change</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., 2.5kHz: +4dB → +2dB"
                    value={corrections[activeChannel]?.eq_changes?.band3 || ''}
                    onChange={(e) => updateEqChange(activeChannel, 'band3', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Band 4 (High) Change</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., 8kHz: +2dB → flat"
                    value={corrections[activeChannel]?.eq_changes?.band4 || ''}
                    onChange={(e) => updateEqChange(activeChannel, 'band4', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Compression Changes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., threshold: -8dB → -12dB, ratio: 4:1 → 3:1"
                  value={corrections[activeChannel]?.compression_changes?.summary || ''}
                  onChange={(e) => updateCorrection(activeChannel, 'compression_changes', { summary: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Why did you make these changes?</label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g., 'Too muddy in the low-mids, had to cut 250Hz significantly. Room was more reverberant than expected.'"
                  value={corrections[activeChannel]?.notes || ''}
                  onChange={(e) => updateCorrection(activeChannel, 'notes', e.target.value)}
                />
              </div>

              <button 
                className="btn btn-secondary"
                onClick={() => { setActiveChannel(null); setShowCorrectionsForm(false); }}
              >
                Done with this channel
              </button>
            </div>
          )}

          {canEdit && Object.keys(corrections).length > 0 && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ marginTop: '1rem' }}>
              {saving ? 'Saving...' : 'Save Corrections'}
            </button>
          )}
        </div>

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

        /* Corrections Section Styles */
        .corrections-card {
          border: 2px solid #f59e0b;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
        }

        .corrections-card .card-header {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .header-subtitle {
          font-size: 0.85rem;
          font-weight: normal;
          color: #92400e;
        }

        .corrections-intro {
          color: #78350f;
          font-size: 0.95rem;
          margin-bottom: 1.5rem;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 0.5rem;
          border-left: 4px solid #f59e0b;
        }

        .existing-corrections {
          margin-bottom: 1.5rem;
        }

        .existing-corrections h4 {
          color: #92400e;
          margin-bottom: 0.75rem;
        }

        .correction-item {
          background: white;
          border: 1px solid #fbbf24;
          border-radius: 0.5rem;
          padding: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .correction-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .correction-instrument {
          background: #fef3c7;
          padding: 0.125rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.85rem;
          color: #92400e;
        }

        .btn-remove {
          margin-left: auto;
          background: #fee2e2;
          color: #dc2626;
          border: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.1rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-remove:hover {
          background: #fecaca;
        }

        .correction-details {
          font-size: 0.85rem;
          color: #374151;
        }

        .correction-details > div {
          margin-bottom: 0.25rem;
        }

        .add-correction-section h4 {
          color: #92400e;
          margin-bottom: 0.75rem;
        }

        .channel-buttons {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .channel-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem;
          background: white;
          border: 2px solid #d1d5db;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .channel-btn:hover {
          border-color: #f59e0b;
          background: #fffbeb;
        }

        .channel-btn.has-correction {
          border-color: #10b981;
          background: #ecfdf5;
        }

        .channel-btn.active {
          border-color: #3b82f6;
          background: #eff6ff;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }

        .channel-num {
          font-weight: bold;
          font-size: 0.9rem;
        }

        .channel-name {
          font-size: 0.75rem;
          color: #6b7280;
          text-align: center;
        }

        .correction-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #10b981;
          color: white;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          font-size: 0.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .correction-form {
          background: white;
          border: 2px solid #3b82f6;
          border-radius: 0.75rem;
          padding: 1.25rem;
          margin-top: 1rem;
        }

        .correction-form h4 {
          color: #1e40af;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #bfdbfe;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 600px) {
          .form-row {
            grid-template-columns: 1fr;
          }
        }

        .btn-secondary {
          background: #6b7280;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: #4b5563;
        }
      `}</style>
    </>
  )
}

export default SetupDetail
