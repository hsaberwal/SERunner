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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>{setup.event_name || 'Unnamed Event'}</h1>
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
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
    </>
  )
}

export default SetupDetail
