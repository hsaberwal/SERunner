import { useState, useEffect } from 'react'
import { locations } from '../services/api'
import Navigation from '../components/Navigation'
import LocationForm, { getEmptyLocationData, emptySpeakerSetup } from '../components/LocationForm'

function Locations() {
  const [locationList, setLocationList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [formData, setFormData] = useState(getEmptyLocationData())

  useEffect(() => {
    loadLocations()
  }, [])

  const loadLocations = async () => {
    try {
      const response = await locations.getAll()
      setLocationList(response.data)
    } catch (error) {
      console.error('Failed to load locations:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(getEmptyLocationData())
    setEditingId(null)
  }

  const handleSubmit = async (cleanedData) => {
    try {
      if (editingId) {
        await locations.update(editingId, cleanedData)
      } else {
        await locations.create(cleanedData)
      }
      setShowForm(false)
      resetForm()
      loadLocations()
    } catch (error) {
      alert('Failed to save location: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleEdit = (loc) => {
    setFormData({
      name: loc.name,
      venue_type: loc.venue_type || '',
      notes: loc.notes || '',
      is_temporary: loc.is_temporary,
      speaker_setup: loc.speaker_setup || { ...emptySpeakerSetup },
      lr_geq_cuts: loc.lr_geq_cuts || {},
      monitor_geq_cuts: loc.monitor_geq_cuts || {},
      room_notes: loc.room_notes || ''
    })
    setEditingId(loc.id)
    setShowForm(true)
    setExpandedId(null)
  }

  const handleDelete = async (id) => {
    if (confirm('Delete this location? This will also delete all setups for this location.')) {
      try {
        await locations.delete(id)
        loadLocations()
      } catch (error) {
        alert('Failed to delete location: ' + (error.response?.data?.detail || error.message))
      }
    }
  }

  const formatSpeakerInfo = (setup) => {
    if (!setup) return null
    const parts = []
    if (setup.lr_mains?.brand) {
      parts.push(`LR: ${setup.lr_mains.quantity}x ${setup.lr_mains.brand} ${setup.lr_mains.model}${setup.lr_mains.powered ? ' (powered)' : ''}`)
    }
    if (setup.sub?.brand && setup.sub.quantity > 0) {
      parts.push(`Sub: ${setup.sub.quantity}x ${setup.sub.brand} ${setup.sub.model}`)
    }
    if (setup.monitors?.brand && setup.monitors.quantity > 0) {
      parts.push(`Mon: ${setup.monitors.quantity}x ${setup.monitors.brand} ${setup.monitors.model}`)
    }
    if (setup.amp?.brand) {
      parts.push(`Amp: ${setup.amp.brand} ${setup.amp.model}`)
    }
    return parts.length > 0 ? parts : null
  }

  const formatGEQCuts = (cuts) => {
    if (!cuts || Object.keys(cuts).length === 0) return null
    return Object.entries(cuts).map(([freq, db]) => `${freq}: ${db}dB`).join(', ')
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <Navigation />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Locations</h1>
          <button className="btn btn-primary" onClick={() => {
            if (showForm) {
              setShowForm(false)
              resetForm()
            } else {
              setShowForm(true)
            }
          }}>
            {showForm ? 'Cancel' : 'Add Location'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="card-header">{editingId ? 'Edit Location' : 'New Location'}</h2>
            <LocationForm
              formData={formData}
              onChange={setFormData}
              onSubmit={handleSubmit}
              onCancel={editingId ? () => { setShowForm(false); resetForm() } : null}
              submitLabel={editingId ? 'Save Changes' : 'Create Location'}
              showCancel={!!editingId}
            />
          </div>
        )}

        <div>
          {locationList.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
              No locations yet. Add your first location to get started.
            </p>
          ) : (
            locationList.map((loc) => (
              <div key={loc.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                      {loc.name}
                      {loc.is_temporary && <span style={{ fontSize: '0.875rem', color: 'var(--warning)', marginLeft: '0.5rem' }}>(Temporary)</span>}
                    </h3>
                    {loc.venue_type && (
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                        {loc.venue_type.charAt(0).toUpperCase() + loc.venue_type.slice(1)}
                      </p>
                    )}

                    {/* Speaker Summary */}
                    {formatSpeakerInfo(loc.speaker_setup) && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {formatSpeakerInfo(loc.speaker_setup).map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    )}

                    {/* Expand/Collapse for details */}
                    {(loc.lr_geq_cuts || loc.monitor_geq_cuts || loc.room_notes || loc.notes) && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === loc.id ? null : loc.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.875rem',
                          marginTop: '0.5rem'
                        }}
                      >
                        {expandedId === loc.id ? 'Hide details' : 'Show details'}
                      </button>
                    )}

                    {/* Expanded Details */}
                    {expandedId === loc.id && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                        {loc.lr_geq_cuts && Object.keys(loc.lr_geq_cuts).length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ fontSize: '0.875rem' }}>LR GEQ Cuts:</strong>
                            <span style={{ fontSize: '0.875rem', marginLeft: '0.5rem' }}>{formatGEQCuts(loc.lr_geq_cuts)}</span>
                          </div>
                        )}
                        {loc.monitor_geq_cuts && Object.keys(loc.monitor_geq_cuts).length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ fontSize: '0.875rem' }}>Monitor GEQ Cuts:</strong>
                            <span style={{ fontSize: '0.875rem', marginLeft: '0.5rem' }}>{formatGEQCuts(loc.monitor_geq_cuts)}</span>
                          </div>
                        )}
                        {loc.room_notes && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ fontSize: '0.875rem' }}>Room Acoustics:</strong>
                            <p style={{ fontSize: '0.875rem', margin: '0.25rem 0 0' }}>{loc.room_notes}</p>
                          </div>
                        )}
                        {loc.notes && (
                          <div>
                            <strong style={{ fontSize: '0.875rem' }}>Notes:</strong>
                            <p style={{ fontSize: '0.875rem', margin: '0.25rem 0 0' }}>{loc.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleEdit(loc)}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(loc.id)}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 600px) {
          .card > div:first-child {
            flex-direction: column;
          }
          .card > div:first-child > div:last-child {
            margin-left: 0 !important;
            margin-top: 1rem;
          }
        }
      `}</style>
    </>
  )
}

export default Locations
