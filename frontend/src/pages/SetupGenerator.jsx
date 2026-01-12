import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { locations, setups } from '../services/api'
import Navigation from '../components/Navigation'

// Default empty speaker setup structure
const emptySpeakerSetup = {
  lr_mains: { brand: '', model: '', powered: true, quantity: 2, notes: '' },
  sub: { brand: '', model: '', powered: true, quantity: 0, notes: '' },
  monitors: { brand: '', model: '', powered: true, quantity: 0, notes: '' },
  amp: { brand: '', model: '', watts: '', notes: '' }
}

// Common GEQ frequencies for ring-out
const geqFrequencies = ['63Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz']

// Known speakers and amps
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

  const handleCreateLocation = async () => {
    if (!newLocation.name.trim()) {
      alert('Please enter a location name')
      return
    }

    setCreatingLocation(true)
    try {
      // Clean up the data before sending
      const cleanedData = {
        ...newLocation,
        speaker_setup: cleanSpeakerSetup(newLocation.speaker_setup),
        lr_geq_cuts: Object.keys(newLocation.lr_geq_cuts).length > 0 ? newLocation.lr_geq_cuts : null,
        monitor_geq_cuts: Object.keys(newLocation.monitor_geq_cuts).length > 0 ? newLocation.monitor_geq_cuts : null,
        room_notes: newLocation.room_notes || null
      }

      const response = await locations.create(cleanedData)
      await loadLocations()
      setFormData({ ...formData, location_id: response.data.id })
      setShowNewLocation(false)
      setNewLocation({
        name: '',
        venue_type: '',
        notes: '',
        is_temporary: false,
        speaker_setup: { ...emptySpeakerSetup },
        lr_geq_cuts: {},
        monitor_geq_cuts: {},
        room_notes: ''
      })
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

  const updateSpeakerField = (category, field, value) => {
    setNewLocation({
      ...newLocation,
      speaker_setup: {
        ...newLocation.speaker_setup,
        [category]: {
          ...newLocation.speaker_setup[category],
          [field]: value
        }
      }
    })
  }

  const updateGEQ = (type, freq, value) => {
    const key = type === 'lr' ? 'lr_geq_cuts' : 'monitor_geq_cuts'
    const newCuts = { ...newLocation[key] }
    if (value === '' || value === 0) {
      delete newCuts[freq]
    } else {
      newCuts[freq] = parseInt(value)
    }
    setNewLocation({ ...newLocation, [key]: newCuts })
  }

  // Get default input source based on performer type
  const getDefaultInputSource = (performerType) => {
    const piezoTypes = ['acoustic_guitar', 'rabab', 'dilruba', 'taus', 'violin', 'sarangi']
    const vocalTypes = ['vocal_female', 'vocal_male']
    const speechTypes = ['podium', 'ardas', 'palki']
    const directTypes = ['keyboard', 'harmonium']

    if (piezoTypes.includes(performerType)) return 'di_piezo'
    if (vocalTypes.includes(performerType)) return 'beta_58a'
    if (speechTypes.includes(performerType)) return 'beta_58a'
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

                {/* Basic Info */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

                {/* Speaker Setup Section */}
                <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Speaker Setup</h4>

                  {/* LR Mains */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>LR Mains</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value={knownSpeakers.find(s => s.value === newLocation.speaker_setup.lr_mains?.model)?.value ||
                               (newLocation.speaker_setup.lr_mains?.model ? 'custom' : '')}
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
                        value={newLocation.speaker_setup.lr_mains?.quantity || ''}
                        onChange={(e) => updateSpeakerField('lr_mains', 'quantity', parseInt(e.target.value) || 0)}
                        style={{ width: '60px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={newLocation.speaker_setup.lr_mains?.powered ?? true}
                          onChange={(e) => updateSpeakerField('lr_mains', 'powered', e.target.checked)}
                        />
                        Powered
                      </label>
                    </div>
                    {(!knownSpeakers.find(s => s.value === newLocation.speaker_setup.lr_mains?.model) && newLocation.speaker_setup.lr_mains?.model) && (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Custom speaker (Brand Model)"
                        value={newLocation.speaker_setup.lr_mains?.model || ''}
                        onChange={(e) => updateSpeakerField('lr_mains', 'model', e.target.value)}
                        style={{ marginTop: '0.25rem' }}
                      />
                    )}
                  </div>

                  {/* Sub */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Subwoofer</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Brand Model (e.g., EV ELX118P)"
                        value={newLocation.speaker_setup.sub?.model || ''}
                        onChange={(e) => updateSpeakerField('sub', 'model', e.target.value)}
                      />
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Qty"
                        min="0"
                        value={newLocation.speaker_setup.sub?.quantity || ''}
                        onChange={(e) => updateSpeakerField('sub', 'quantity', parseInt(e.target.value) || 0)}
                        style={{ width: '60px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={newLocation.speaker_setup.sub?.powered ?? true}
                          onChange={(e) => updateSpeakerField('sub', 'powered', e.target.checked)}
                        />
                        Powered
                      </label>
                    </div>
                  </div>

                  {/* Monitors */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Monitors</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value={knownSpeakers.find(s => s.value === newLocation.speaker_setup.monitors?.model)?.value ||
                               (newLocation.speaker_setup.monitors?.model ? 'custom' : '')}
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
                        value={newLocation.speaker_setup.monitors?.quantity || ''}
                        onChange={(e) => updateSpeakerField('monitors', 'quantity', parseInt(e.target.value) || 0)}
                        style={{ width: '60px' }}
                      />
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={newLocation.speaker_setup.monitors?.powered ?? true}
                          onChange={(e) => updateSpeakerField('monitors', 'powered', e.target.checked)}
                        />
                        Powered
                      </label>
                    </div>
                    {(!knownSpeakers.find(s => s.value === newLocation.speaker_setup.monitors?.model) && newLocation.speaker_setup.monitors?.model) && (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Custom speaker (Brand Model)"
                        value={newLocation.speaker_setup.monitors?.model || ''}
                        onChange={(e) => updateSpeakerField('monitors', 'model', e.target.value)}
                        style={{ marginTop: '0.25rem' }}
                      />
                    )}
                  </div>

                  {/* Amp */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
                      Amplifier <span style={{ fontWeight: 'normal' }}>(if passive speakers)</span>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="form-select"
                        value={knownAmps.find(a => a.value === newLocation.speaker_setup.amp?.model)?.value ||
                               (newLocation.speaker_setup.amp?.model ? 'custom' : '')}
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
                        value={newLocation.speaker_setup.amp?.watts || ''}
                        onChange={(e) => updateSpeakerField('amp', 'watts', e.target.value)}
                        style={{ width: '80px' }}
                      />
                    </div>
                    {(!knownAmps.find(a => a.value === newLocation.speaker_setup.amp?.model) && newLocation.speaker_setup.amp?.model) && (
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Custom amp (Brand Model)"
                        value={newLocation.speaker_setup.amp?.model || ''}
                        onChange={(e) => updateSpeakerField('amp', 'model', e.target.value)}
                        style={{ marginTop: '0.25rem' }}
                      />
                    )}
                  </div>
                </div>

                {/* GEQ Cuts Section */}
                <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>GEQ Cuts from Ring-Out</h4>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    Record problem frequencies found during ring-out (negative dB values).
                  </p>

                  {/* LR GEQ */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>LR Main GEQ</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {geqFrequencies.map(freq => (
                        <div key={`lr-${freq}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{freq}</label>
                          <input
                            type="number"
                            className="form-input"
                            value={newLocation.lr_geq_cuts[freq] || ''}
                            onChange={(e) => updateGEQ('lr', freq, e.target.value)}
                            placeholder="0"
                            min="-12"
                            max="0"
                            style={{ width: '42px', textAlign: 'center', padding: '0.2rem', fontSize: '0.8rem' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Monitor GEQ */}
                  <div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Monitor GEQ</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {geqFrequencies.map(freq => (
                        <div key={`mon-${freq}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{freq}</label>
                          <input
                            type="number"
                            className="form-input"
                            value={newLocation.monitor_geq_cuts[freq] || ''}
                            onChange={(e) => updateGEQ('monitor', freq, e.target.value)}
                            placeholder="0"
                            min="-12"
                            max="0"
                            style={{ width: '42px', textAlign: 'center', padding: '0.2rem', fontSize: '0.8rem' }}
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
                    value={newLocation.room_notes}
                    onChange={(e) => setNewLocation({ ...newLocation, room_notes: e.target.value })}
                    placeholder="Dead spots, reflections, problem areas..."
                    rows={2}
                  />
                </div>

                {/* General Notes */}
                <div className="form-group">
                  <label className="form-label">General Notes</label>
                  <textarea
                    className="form-textarea"
                    value={newLocation.notes}
                    onChange={(e) => setNewLocation({ ...newLocation, notes: e.target.value })}
                    placeholder="Contact info, access instructions, power locations..."
                    rows={2}
                  />
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
                      setNewLocation({
                        name: '',
                        venue_type: '',
                        notes: '',
                        is_temporary: false,
                        speaker_setup: { ...emptySpeakerSetup },
                        lr_geq_cuts: {},
                        monitor_geq_cuts: {},
                        room_notes: ''
                      })
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
                    <optgroup label="Speech / Recitation">
                      <option value="podium">Podium / Speech</option>
                      <option value="ardas">Ardas</option>
                      <option value="palki">Palki / Scripture Reading</option>
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
