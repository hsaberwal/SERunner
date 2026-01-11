import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { locations, setups } from '../services/api'
import Navigation from '../components/Navigation'

function SetupGenerator() {
  const navigate = useNavigate()
  const [locationList, setLocationList] = useState([])
  const [loading, setLoading] = useState(false)
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [creatingLocation, setCreatingLocation] = useState(false)
  const [formData, setFormData] = useState({
    location_id: '',
    event_name: '',
    event_date: '',
    performers: [{ type: '', count: 1, input_source: '', notes: '' }]
  })
  const [newLocation, setNewLocation] = useState({
    name: '',
    venue_type: '',
    notes: '',
    is_temporary: false
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
    }
  }

  const handleCreateLocation = async () => {
    if (!newLocation.name.trim()) {
      alert('Please enter a location name')
      return
    }

    setCreatingLocation(true)
    try {
      const response = await locations.create(newLocation)
      await loadLocations()
      setFormData({ ...formData, location_id: response.data.id })
      setShowNewLocation(false)
      setNewLocation({ name: '', venue_type: '', notes: '', is_temporary: false })
    } catch (error) {
      alert('Failed to create location: ' + (error.response?.data?.detail || error.message))
    } finally {
      setCreatingLocation(false)
    }
  }

  const handleLocationChange = (e) => {
    const value = e.target.value
    if (value === 'new') {
      setShowNewLocation(true)
      setFormData({ ...formData, location_id: '' })
    } else {
      setShowNewLocation(false)
      setFormData({ ...formData, location_id: value })
    }
  }

  // Get default input source based on performer type
  const getDefaultInputSource = (performerType) => {
    const piezoTypes = ['acoustic_guitar', 'rabab', 'dilruba', 'taus', 'violin', 'sarangi']
    const vocalTypes = ['vocal_female', 'vocal_male']
    const directTypes = ['keyboard', 'harmonium']

    if (piezoTypes.includes(performerType)) return 'di_piezo'
    if (vocalTypes.includes(performerType)) return 'beta_58a'
    if (directTypes.includes(performerType)) return 'direct'
    if (performerType === 'tabla') return 'beta_57a'
    if (performerType === 'flute') return 'beta_57a'
    return ''
  }

  const addPerformer = () => {
    setFormData({
      ...formData,
      performers: [...formData.performers, { type: '', count: 1, input_source: '', notes: '' }]
    })
  }

  const removePerformer = (index) => {
    setFormData({
      ...formData,
      performers: formData.performers.filter((_, i) => i !== index)
    })
  }

  const updatePerformer = (index, field, value) => {
    const newPerformers = [...formData.performers]
    newPerformers[index][field] = value

    // Auto-set default input source when type changes
    if (field === 'type' && value) {
      const defaultSource = getDefaultInputSource(value)
      if (!newPerformers[index].input_source) {
        newPerformers[index].input_source = defaultSource
      }
    }

    setFormData({ ...formData, performers: newPerformers })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.location_id) {
      alert('Please select or create a location')
      return
    }

    setLoading(true)

    try {
      const response = await setups.generate(formData)
      navigate(`/setup/${response.data.id}`)
    } catch (error) {
      alert('Failed to generate setup: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Navigation />
      <div className="container">
        <h1 style={{ marginBottom: '2rem' }}>Generate QuPac Setup</h1>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Location *</label>
              <select
                className="form-select"
                value={showNewLocation ? 'new' : formData.location_id}
                onChange={handleLocationChange}
                required={!showNewLocation}
              >
                <option value="">Select location...</option>
                {locationList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.is_temporary ? '(Temporary)' : ''}
                  </option>
                ))}
                <option value="new">+ Create New Location</option>
              </select>
            </div>

            {showNewLocation && (
              <div style={{
                background: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
                border: '1px solid var(--border-color)'
              }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>New Location</h3>

                <div className="form-group">
                  <label className="form-label">Location Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    placeholder="e.g., St. Mary's Church"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Venue Type</label>
                  <select
                    className="form-select"
                    value={newLocation.venue_type}
                    onChange={(e) => setNewLocation({ ...newLocation, venue_type: e.target.value })}
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

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={newLocation.notes}
                    onChange={(e) => setNewLocation({ ...newLocation, notes: e.target.value })}
                    placeholder="Speaker placement, acoustic notes, etc."
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={newLocation.is_temporary}
                      onChange={(e) => setNewLocation({ ...newLocation, is_temporary: e.target.checked })}
                    />
                    Temporary location (one-time event)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateLocation}
                    disabled={creatingLocation}
                  >
                    {creatingLocation ? 'Creating...' : 'Create Location'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowNewLocation(false)
                      setNewLocation({ name: '', venue_type: '', notes: '', is_temporary: false })
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Event Name</label>
              <input
                type="text"
                className="form-input"
                value={formData.event_name}
                onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                placeholder="Sunday Service, Concert, etc."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Event Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Performers *</label>
              {formData.performers.map((performer, index) => (
                <div key={index} className="performer-row">
                  <select
                    className="form-select"
                    value={performer.type}
                    onChange={(e) => updatePerformer(index, 'type', e.target.value)}
                    required
                  >
                    <option value="">Select type...</option>
                    <optgroup label="Vocals">
                      <option value="vocal_female">Female Vocal</option>
                      <option value="vocal_male">Male Vocal</option>
                    </optgroup>
                    <optgroup label="Percussion">
                      <option value="tabla">Tabla</option>
                    </optgroup>
                    <optgroup label="Wind">
                      <option value="flute">Flute</option>
                    </optgroup>
                    <optgroup label="Strings (Piezo/DI)">
                      <option value="acoustic_guitar">Acoustic Guitar</option>
                      <option value="rabab">Rabab / Rubab</option>
                      <option value="dilruba">Dilruba / Esraj</option>
                      <option value="taus">Taus / Mayuri</option>
                      <option value="violin">Violin (Piezo)</option>
                      <option value="sarangi">Sarangi</option>
                    </optgroup>
                    <optgroup label="Keys">
                      <option value="harmonium">Harmonium</option>
                      <option value="keyboard">Keyboard / Synth</option>
                    </optgroup>
                    <option value="other">Other</option>
                  </select>
                  <select
                    className="form-select"
                    value={performer.input_source}
                    onChange={(e) => updatePerformer(index, 'input_source', e.target.value)}
                    style={{ minWidth: '140px' }}
                  >
                    <option value="">Input source...</option>
                    <optgroup label="Microphones">
                      <option value="beta_58a">Shure Beta 58A</option>
                      <option value="beta_57a">Shure Beta 57A</option>
                      <option value="c1000s">AKG C1000S</option>
                    </optgroup>
                    <optgroup label="DI / Direct">
                      <option value="di_piezo">DI Box (Piezo)</option>
                      <option value="direct">Direct / Line</option>
                    </optgroup>
                  </select>
                  <input
                    type="number"
                    className="form-input"
                    value={performer.count}
                    onChange={(e) => updatePerformer(index, 'count', parseInt(e.target.value))}
                    min="1"
                    placeholder="Count"
                    style={{ width: '70px' }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={performer.notes}
                    onChange={(e) => updatePerformer(index, 'notes', e.target.value)}
                    placeholder="Notes (optional)"
                  />
                  {formData.performers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePerformer(index)}
                      className="btn btn-danger"
                      style={{ padding: '0.5rem 1rem', flexShrink: 0 }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addPerformer} className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
                Add Performer
              </button>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading || showNewLocation}>
              {loading ? 'Generating...' : 'Generate Setup'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .performer-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }
        .performer-row .form-select {
          flex: 2;
          min-width: 150px;
        }
        .performer-row .form-input:nth-child(3) {
          flex: 2;
          min-width: 150px;
        }
        @media (max-width: 600px) {
          .performer-row {
            flex-direction: column;
          }
          .performer-row > * {
            width: 100% !important;
          }
        }
      `}</style>
    </>
  )
}

export default SetupGenerator
