import { useState, useEffect } from 'react'
import { locations } from '../services/api'
import Navigation from '../components/Navigation'

// Default empty speaker setup structure
const emptySpeakerSetup = {
  lr_mains: { brand: '', model: '', powered: true, quantity: 2, watts: '', notes: '' },
  sub: { brand: '', model: '', powered: true, quantity: 0, watts: '', notes: '' },
  monitors: { brand: '', model: '', powered: true, quantity: 0, watts: '', notes: '' },
  amp: { brand: '', model: '', watts: '', channels: '', notes: '' }
}

// Common GEQ frequencies for ring-out
const geqFrequencies = ['63Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz']

// Known speakers and amps (same as SetupGenerator)
const knownSpeakers = [
  { value: '', label: 'Select or type custom...' },
  { value: 'Martin Audio CDD-10', label: 'Martin Audio CDD-10' },
  { value: 'EV ZLX-12P', label: 'Electro-Voice ZLX-12P' },
  { value: 'EV ZX1-90', label: 'Electro-Voice ZX1-90' },
  { value: 'EV Evolve 50', label: 'Electro-Voice Evolve 50' },
  { value: 'custom', label: 'Other (type below)' }
]

const knownAmps = [
  { value: '', label: 'Select or type custom...' },
  { value: 'Crown XTi 1002', label: 'Crown XTi 1002' },
  { value: 'Crown XTi 2002', label: 'Crown XTi 2002' },
  { value: 'Crown XTi 4002', label: 'Crown XTi 4002' },
  { value: 'Crown XLS 1002', label: 'Crown XLS 1002' },
  { value: 'Crown XLS 1502', label: 'Crown XLS 1502' },
  { value: 'Crown XLS 2002', label: 'Crown XLS 2002' },
  { value: 'Crown CDi 1000', label: 'Crown CDi 1000 (70V)' },
  { value: 'custom', label: 'Other (type below)' }
]

function Locations() {
  const [locationList, setLocationList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    venue_type: '',
    notes: '',
    is_temporary: false,
    speaker_setup: { ...emptySpeakerSetup },
    lr_geq_cuts: {},
    monitor_geq_cuts: {},
    room_notes: ''
  })

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
    setFormData({
      name: '',
      venue_type: '',
      notes: '',
      is_temporary: false,
      speaker_setup: { ...emptySpeakerSetup },
      lr_geq_cuts: {},
      monitor_geq_cuts: {},
      room_notes: ''
    })
    setEditingId(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      // Clean up empty speaker setup values
      const cleanedData = {
        ...formData,
        speaker_setup: cleanSpeakerSetup(formData.speaker_setup),
        lr_geq_cuts: Object.keys(formData.lr_geq_cuts).length > 0 ? formData.lr_geq_cuts : null,
        monitor_geq_cuts: Object.keys(formData.monitor_geq_cuts).length > 0 ? formData.monitor_geq_cuts : null,
        room_notes: formData.room_notes || null
      }

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

  const cleanSpeakerSetup = (setup) => {
    if (!setup) return null
    const cleaned = {}
    for (const [key, value] of Object.entries(setup)) {
      if (value && (value.brand || value.model || value.quantity > 0)) {
        cleaned[key] = value
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null
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

  const updateSpeakerField = (category, field, value) => {
    setFormData({
      ...formData,
      speaker_setup: {
        ...formData.speaker_setup,
        [category]: {
          ...formData.speaker_setup[category],
          [field]: value
        }
      }
    })
  }

  const updateGEQ = (type, freq, value) => {
    const key = type === 'lr' ? 'lr_geq_cuts' : 'monitor_geq_cuts'
    const newCuts = { ...formData[key] }
    if (value === '' || value === 0) {
      delete newCuts[freq]
    } else {
      newCuts[freq] = parseInt(value)
    }
    setFormData({ ...formData, [key]: newCuts })
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
            <form onSubmit={handleSubmit}>
              {/* Basic Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., St. Mary's Church"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Venue Type</label>
                  <select
                    className="form-select"
                    value={formData.venue_type}
                    onChange={(e) => setFormData({ ...formData, venue_type: e.target.value })}
                  >
                    <option value="">Select type...</option>
                    <option value="gurdwara">Gurdwara</option>
                    <option value="church">Church</option>
                    <option value="temple">Temple</option>
                    <option value="hall">Hall</option>
                    <option value="cafe">Cafe</option>
                    <option value="outdoor">Outdoor</option>
                    <option value="school">School</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_temporary}
                    onChange={(e) => setFormData({ ...formData, is_temporary: e.target.checked })}
                  />
                  Temporary location (one-time event)
                </label>
              </div>

              {/* Speaker Setup Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Speaker Setup</h3>

                {/* LR Mains */}
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>LR Mains</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value={knownSpeakers.find(s => s.value === formData.speaker_setup.lr_mains?.model)?.value ||
                             (formData.speaker_setup.lr_mains?.model ? 'custom' : '')}
                      onChange={(e) => {
                        if (e.target.value && e.target.value !== 'custom') {
                          const parts = e.target.value.split(' ')
                          updateSpeakerField('lr_mains', 'brand', parts[0])
                          updateSpeakerField('lr_mains', 'model', e.target.value)
                        } else if (e.target.value === 'custom') {
                          updateSpeakerField('lr_mains', 'brand', '')
                          updateSpeakerField('lr_mains', 'model', '')
                        }
                      }}
                    >
                      {knownSpeakers.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty"
                      min="0"
                      value={formData.speaker_setup.lr_mains?.quantity || ''}
                      onChange={(e) => updateSpeakerField('lr_mains', 'quantity', parseInt(e.target.value) || 0)}
                      style={{ width: '70px' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={formData.speaker_setup.lr_mains?.powered ?? true}
                        onChange={(e) => updateSpeakerField('lr_mains', 'powered', e.target.checked)}
                      />
                      Powered
                    </label>
                  </div>
                  {(!knownSpeakers.find(s => s.value === formData.speaker_setup.lr_mains?.model) && formData.speaker_setup.lr_mains?.model) && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Custom speaker (Brand Model)"
                      value={formData.speaker_setup.lr_mains?.model || ''}
                      onChange={(e) => updateSpeakerField('lr_mains', 'model', e.target.value)}
                      style={{ marginTop: '0.5rem' }}
                    />
                  )}
                </div>

                {/* Sub */}
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Subwoofer</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Brand Model (e.g., EV ELX118P)"
                      value={formData.speaker_setup.sub?.model || ''}
                      onChange={(e) => updateSpeakerField('sub', 'model', e.target.value)}
                    />
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty"
                      min="0"
                      value={formData.speaker_setup.sub?.quantity || ''}
                      onChange={(e) => updateSpeakerField('sub', 'quantity', parseInt(e.target.value) || 0)}
                      style={{ width: '70px' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={formData.speaker_setup.sub?.powered ?? true}
                        onChange={(e) => updateSpeakerField('sub', 'powered', e.target.checked)}
                      />
                      Powered
                    </label>
                  </div>
                </div>

                {/* Monitors */}
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Monitors</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value={knownSpeakers.find(s => s.value === formData.speaker_setup.monitors?.model)?.value ||
                             (formData.speaker_setup.monitors?.model ? 'custom' : '')}
                      onChange={(e) => {
                        if (e.target.value && e.target.value !== 'custom') {
                          const parts = e.target.value.split(' ')
                          updateSpeakerField('monitors', 'brand', parts[0])
                          updateSpeakerField('monitors', 'model', e.target.value)
                        } else if (e.target.value === 'custom') {
                          updateSpeakerField('monitors', 'brand', '')
                          updateSpeakerField('monitors', 'model', '')
                        }
                      }}
                    >
                      {knownSpeakers.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Qty"
                      min="0"
                      value={formData.speaker_setup.monitors?.quantity || ''}
                      onChange={(e) => updateSpeakerField('monitors', 'quantity', parseInt(e.target.value) || 0)}
                      style={{ width: '70px' }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        checked={formData.speaker_setup.monitors?.powered ?? true}
                        onChange={(e) => updateSpeakerField('monitors', 'powered', e.target.checked)}
                      />
                      Powered
                    </label>
                  </div>
                  {(!knownSpeakers.find(s => s.value === formData.speaker_setup.monitors?.model) && formData.speaker_setup.monitors?.model) && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Custom speaker (Brand Model)"
                      value={formData.speaker_setup.monitors?.model || ''}
                      onChange={(e) => updateSpeakerField('monitors', 'model', e.target.value)}
                      style={{ marginTop: '0.5rem' }}
                    />
                  )}
                </div>

                {/* Amp (for passive speakers) */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Amplifier <span style={{ fontWeight: 'normal' }}>(if using passive speakers)</span>
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      className="form-select"
                      value={knownAmps.find(a => a.value === formData.speaker_setup.amp?.model)?.value ||
                             (formData.speaker_setup.amp?.model ? 'custom' : '')}
                      onChange={(e) => {
                        if (e.target.value && e.target.value !== 'custom') {
                          updateSpeakerField('amp', 'brand', 'Crown')
                          updateSpeakerField('amp', 'model', e.target.value)
                        } else if (e.target.value === 'custom') {
                          updateSpeakerField('amp', 'brand', '')
                          updateSpeakerField('amp', 'model', '')
                        }
                      }}
                    >
                      {knownAmps.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Watts"
                      value={formData.speaker_setup.amp?.watts || ''}
                      onChange={(e) => updateSpeakerField('amp', 'watts', e.target.value)}
                      style={{ width: '100px' }}
                    />
                  </div>
                  {(!knownAmps.find(a => a.value === formData.speaker_setup.amp?.model) && formData.speaker_setup.amp?.model) && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Custom amp (Brand Model)"
                      value={formData.speaker_setup.amp?.model || ''}
                      onChange={(e) => updateSpeakerField('amp', 'model', e.target.value)}
                      style={{ marginTop: '0.5rem' }}
                    />
                  )}
                </div>
              </div>

              {/* GEQ Cuts Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>GEQ Cuts from Ring-Out</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Record problem frequencies found during ring-out. These will be highlighted in future setups.
                </p>

                {/* LR GEQ */}
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>LR Main GEQ</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {geqFrequencies.map(freq => (
                      <div key={`lr-${freq}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{freq}</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.lr_geq_cuts[freq] || ''}
                          onChange={(e) => updateGEQ('lr', freq, e.target.value)}
                          placeholder="0"
                          min="-12"
                          max="0"
                          style={{ width: '50px', textAlign: 'center', padding: '0.25rem' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Monitor GEQ */}
                <div>
                  <h4 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Monitor GEQ</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {geqFrequencies.map(freq => (
                      <div key={`mon-${freq}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{freq}</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.monitor_geq_cuts[freq] || ''}
                          onChange={(e) => updateGEQ('monitor', freq, e.target.value)}
                          placeholder="0"
                          min="-12"
                          max="0"
                          style={{ width: '50px', textAlign: 'center', padding: '0.25rem' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Room Notes */}
              <div className="form-group">
                <label className="form-label">Room Acoustics Notes</label>
                <textarea
                  className="form-textarea"
                  value={formData.room_notes}
                  onChange={(e) => setFormData({ ...formData, room_notes: e.target.value })}
                  placeholder="Dead spots, reflections, problem areas, best speaker positions..."
                  rows={2}
                />
              </div>

              {/* General Notes */}
              <div className="form-group">
                <label className="form-label">General Notes</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Contact info, access instructions, power locations..."
                  rows={2}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">
                  {editingId ? 'Save Changes' : 'Create Location'}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
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
