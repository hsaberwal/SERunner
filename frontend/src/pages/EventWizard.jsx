import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { locations, setups } from '../services/api'
import Navigation from '../components/Navigation'
import LocationForm, { getEmptyLocationData, geqFrequencies } from '../components/LocationForm'

// Phase definitions
const PHASES = [
  { id: 1, name: 'Physical Setup', icon: '1' },
  { id: 2, name: 'System Check', icon: '2' },
  { id: 3, name: 'Ring Out Mains', icon: '3' },
  { id: 4, name: 'Ring Out Monitors', icon: '4' },
  { id: 5, name: 'Soundcheck', icon: '5' },
  { id: 6, name: 'Final Mix', icon: '6' }
]

function EventWizard() {
  const navigate = useNavigate()
  const [currentPhase, setCurrentPhase] = useState(1)
  const [locationList, setLocationList] = useState([])
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [generatedSetupId, setGeneratedSetupId] = useState(null)
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [creatingLocation, setCreatingLocation] = useState(false)
  const [newLocation, setNewLocation] = useState(getEmptyLocationData())

  // Event data
  const [eventData, setEventData] = useState({
    location_id: '',
    event_name: '',
    event_date: new Date().toISOString().split('T')[0],
    performers: [{ type: '', count: 1, input_source: '', notes: '' }]
  })

  // Phase completion tracking
  const [phaseCompleted, setPhaseCompleted] = useState({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false
  })

  // Checklist states for phases 1 & 2
  const [phase1Checklist, setPhase1Checklist] = useState({
    speakers_placed: false,
    monitors_placed: false,
    mixer_connected: false,
    cables_run: false,
    power_on: false
  })

  const [phase2Checklist, setPhase2Checklist] = useState({
    pink_noise_sent: false,
    room_walked: false,
    issues_noted: false
  })

  // Ring-out data (will update location)
  const [ringOutData, setRingOutData] = useState({
    lr_geq_cuts: {},
    monitor_geq_cuts: {}
  })

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    // When location changes, load its existing GEQ cuts
    if (selectedLocation) {
      setRingOutData({
        lr_geq_cuts: selectedLocation.lr_geq_cuts || {},
        monitor_geq_cuts: selectedLocation.monitor_geq_cuts || {}
      })
    }
  }, [selectedLocation])

  const loadLocations = async () => {
    try {
      const response = await locations.getAll()
      setLocationList(response.data)
    } catch (error) {
      console.error('Failed to load locations:', error)
    }
  }

  const handleLocationSelect = (locationId) => {
    if (locationId === 'new') {
      setShowNewLocation(true)
      setSelectedLocation(null)
      setEventData({ ...eventData, location_id: '' })
    } else {
      setShowNewLocation(false)
      const location = locationList.find(l => l.id === locationId)
      setSelectedLocation(location)
      setEventData({ ...eventData, location_id: locationId })
    }
  }

  const handleCreateLocation = async (cleanedData) => {
    setCreatingLocation(true)
    try {
      const response = await locations.create(cleanedData)
      await loadLocations()
      // Select the newly created location
      setEventData({ ...eventData, location_id: response.data.id })
      setSelectedLocation(response.data)
      setShowNewLocation(false)
      setNewLocation(getEmptyLocationData())
    } catch (error) {
      alert('Failed to create location: ' + (error.response?.data?.detail || error.message))
    } finally {
      setCreatingLocation(false)
    }
  }

  const updateGEQ = (type, freq, value) => {
    const key = type === 'lr' ? 'lr_geq_cuts' : 'monitor_geq_cuts'
    const newCuts = { ...ringOutData[key] }
    if (value === '' || value === 0) {
      delete newCuts[freq]
    } else {
      newCuts[freq] = parseInt(value)
    }
    setRingOutData({ ...ringOutData, [key]: newCuts })
  }

  const saveGEQToLocation = async () => {
    if (!selectedLocation) return
    try {
      await locations.update(selectedLocation.id, {
        ...selectedLocation,
        lr_geq_cuts: Object.keys(ringOutData.lr_geq_cuts).length > 0 ? ringOutData.lr_geq_cuts : null,
        monitor_geq_cuts: Object.keys(ringOutData.monitor_geq_cuts).length > 0 ? ringOutData.monitor_geq_cuts : null
      })
      // Refresh location data
      const response = await locations.getAll()
      setLocationList(response.data)
      const updated = response.data.find(l => l.id === selectedLocation.id)
      setSelectedLocation(updated)
    } catch (error) {
      console.error('Failed to save GEQ cuts:', error)
    }
  }

  // Get default input source based on performer type
  const getDefaultInputSource = (performerType) => {
    const piezoTypes = ['acoustic_guitar', 'rabab', 'dilruba', 'taus', 'violin', 'sarangi']
    const vocalTypes = ['vocal_female', 'vocal_male']
    const speechTypes = ['podium', 'ardas', 'palki']
    const directTypes = ['keyboard']

    if (piezoTypes.includes(performerType)) return 'di_piezo'
    if (vocalTypes.includes(performerType)) return 'beta_58a'
    if (speechTypes.includes(performerType)) return 'beta_58a'
    if (directTypes.includes(performerType)) return 'direct'
    if (performerType === 'tabla') return 'beta_57a'
    if (performerType === 'flute') return 'beta_57a'
    if (performerType === 'harmonium') return 'beta_57a'
    return ''
  }

  const addPerformer = () => {
    setEventData({
      ...eventData,
      performers: [...eventData.performers, { type: '', count: 1, input_source: '', notes: '' }]
    })
  }

  const removePerformer = (index) => {
    setEventData({
      ...eventData,
      performers: eventData.performers.filter((_, i) => i !== index)
    })
  }

  const updatePerformer = (index, field, value) => {
    const newPerformers = [...eventData.performers]
    newPerformers[index][field] = value

    if (field === 'type' && value) {
      const defaultSource = getDefaultInputSource(value)
      if (!newPerformers[index].input_source) {
        newPerformers[index].input_source = defaultSource
      }
    }

    setEventData({ ...eventData, performers: newPerformers })
  }

  const generateSetup = async () => {
    if (!eventData.location_id) {
      alert('Please select a location')
      return
    }

    setLoading(true)
    setLoadingMessage('Preparing your setup request...')

    try {
      const messageTimer = setTimeout(() => {
        setLoadingMessage('Analyzing performer lineup and venue details...')
      }, 2000)

      const messageTimer2 = setTimeout(() => {
        setLoadingMessage('Claude is generating your QuPac configuration...')
      }, 5000)

      const messageTimer3 = setTimeout(() => {
        setLoadingMessage('Almost there... building detailed instructions...')
      }, 15000)

      const messageTimer4 = setTimeout(() => {
        setLoadingMessage('Still working... complex setups take a bit longer...')
      }, 30000)

      const response = await setups.generate(eventData)

      clearTimeout(messageTimer)
      clearTimeout(messageTimer2)
      clearTimeout(messageTimer3)
      clearTimeout(messageTimer4)

      setGeneratedSetupId(response.data.id)
      setPhaseCompleted({ ...phaseCompleted, 5: true })
      setCurrentPhase(6)
    } catch (error) {
      alert('Failed to generate setup: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const completePhase = (phase) => {
    setPhaseCompleted({ ...phaseCompleted, [phase]: true })
    if (phase < 6) {
      setCurrentPhase(phase + 1)
    }
  }

  const goToPhase = (phase) => {
    // Allow going to any phase up to current + 1
    if (phase <= currentPhase || phaseCompleted[phase - 1]) {
      setCurrentPhase(phase)
    }
  }

  // Render phase content
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 1:
        return renderPhase1()
      case 2:
        return renderPhase2()
      case 3:
        return renderPhase3()
      case 4:
        return renderPhase4()
      case 5:
        return renderPhase5()
      case 6:
        return renderPhase6()
      default:
        return null
    }
  }

  // Phase 1: Physical Setup
  const renderPhase1 = () => (
    <div className="phase-content">
      <h2>Phase 1: Physical Setup</h2>
      <p className="phase-description">
        Set up your PA system in the correct order. Complete each item before moving on.
      </p>

      <div className="form-group">
        <label className="form-label">Select Location *</label>
        <select
          className="form-select"
          value={showNewLocation ? 'new' : eventData.location_id}
          onChange={(e) => handleLocationSelect(e.target.value)}
        >
          <option value="">Select venue...</option>
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
          <LocationForm
            formData={newLocation}
            onChange={setNewLocation}
            onSubmit={handleCreateLocation}
            onCancel={() => {
              setShowNewLocation(false)
              setNewLocation(getEmptyLocationData())
            }}
            submitLabel={creatingLocation ? 'Creating...' : 'Create Location'}
            showCancel={true}
            compact={true}
            showGEQ={false}
            disabled={creatingLocation}
          />
        </div>
      )}

      {selectedLocation && (
        <>
          <div className="info-box">
            <h4>Venue Info</h4>
            <p><strong>Type:</strong> {selectedLocation.venue_type || 'Not specified'}</p>
            {selectedLocation.speaker_setup?.lr_mains?.model && (
              <p><strong>Mains:</strong> {selectedLocation.speaker_setup.lr_mains.model} x{selectedLocation.speaker_setup.lr_mains.quantity}</p>
            )}
            {selectedLocation.speaker_setup?.monitors?.model && (
              <p><strong>Monitors:</strong> {selectedLocation.speaker_setup.monitors.model} x{selectedLocation.speaker_setup.monitors.quantity}</p>
            )}
            {selectedLocation.room_notes && (
              <p><strong>Room Notes:</strong> {selectedLocation.room_notes}</p>
            )}
          </div>

          <div className="checklist">
            <h4>Setup Checklist</h4>

            <label className="checklist-item">
              <input
                type="checkbox"
                checked={phase1Checklist.speakers_placed}
                onChange={(e) => setPhase1Checklist({ ...phase1Checklist, speakers_placed: e.target.checked })}
              />
              <span>FOH speakers placed and aimed at audience</span>
            </label>

            <label className="checklist-item">
              <input
                type="checkbox"
                checked={phase1Checklist.monitors_placed}
                onChange={(e) => setPhase1Checklist({ ...phase1Checklist, monitors_placed: e.target.checked })}
              />
              <span>Monitor wedges positioned for performers</span>
            </label>

            <label className="checklist-item">
              <input
                type="checkbox"
                checked={phase1Checklist.mixer_connected}
                onChange={(e) => setPhase1Checklist({ ...phase1Checklist, mixer_connected: e.target.checked })}
              />
              <span>QuPac connected (XLR to speakers, dSNAKE if using)</span>
            </label>

            <label className="checklist-item">
              <input
                type="checkbox"
                checked={phase1Checklist.cables_run}
                onChange={(e) => setPhase1Checklist({ ...phase1Checklist, cables_run: e.target.checked })}
              />
              <span>Mic cables run to stage positions</span>
            </label>

            <label className="checklist-item">
              <input
                type="checkbox"
                checked={phase1Checklist.power_on}
                onChange={(e) => setPhase1Checklist({ ...phase1Checklist, power_on: e.target.checked })}
              />
              <span>Power on: Mixer first, then amps/powered speakers LAST</span>
            </label>
          </div>
        </>
      )}

      <button
        className="btn btn-primary"
        onClick={() => completePhase(1)}
        disabled={!eventData.location_id || !Object.values(phase1Checklist).every(v => v) || showNewLocation}
      >
        Continue to System Check
      </button>
    </div>
  )

  // Phase 2: System Check
  const renderPhase2 = () => (
    <div className="phase-content">
      <h2>Phase 2: System Check</h2>
      <p className="phase-description">
        Test your PA system before performers arrive. Listen for issues.
      </p>

      <div className="instruction-box">
        <h4>How to Send Pink Noise</h4>
        <ol>
          <li>On QuPac, go to <strong>UTILITY &gt; Signal Generator</strong></li>
          <li>Select <strong>Pink Noise</strong></li>
          <li>Route to <strong>LR Main</strong> output</li>
          <li>Start at <strong>-20dB</strong>, gradually increase</li>
          <li>Walk the room while listening</li>
        </ol>
      </div>

      {selectedLocation?.notes && (
        <div className="info-box warning">
          <h4>Previous Notes for This Venue</h4>
          <p>{selectedLocation.notes}</p>
        </div>
      )}

      <div className="checklist">
        <h4>System Check</h4>

        <label className="checklist-item">
          <input
            type="checkbox"
            checked={phase2Checklist.pink_noise_sent}
            onChange={(e) => setPhase2Checklist({ ...phase2Checklist, pink_noise_sent: e.target.checked })}
          />
          <span>Pink noise playing through FOH speakers</span>
        </label>

        <label className="checklist-item">
          <input
            type="checkbox"
            checked={phase2Checklist.room_walked}
            onChange={(e) => setPhase2Checklist({ ...phase2Checklist, room_walked: e.target.checked })}
          />
          <span>Walked the room - checked for dead spots, reflections</span>
        </label>

        <label className="checklist-item">
          <input
            type="checkbox"
            checked={phase2Checklist.issues_noted}
            onChange={(e) => setPhase2Checklist({ ...phase2Checklist, issues_noted: e.target.checked })}
          />
          <span>Noted any acoustic issues (or confirmed none)</span>
        </label>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => completePhase(2)}
        disabled={!Object.values(phase2Checklist).every(v => v)}
      >
        Continue to Ring Out Mains
      </button>
    </div>
  )

  // Phase 3: Ring Out Mains
  const renderPhase3 = () => (
    <div className="phase-content">
      <h2>Phase 3: Ring Out Mains (LR)</h2>
      <p className="phase-description">
        Find and cut feedback frequencies in your main speakers using the measurement mic.
      </p>

      <div className="instruction-box">
        <h4>Ring Out Procedure</h4>
        <ol>
          <li>Connect <strong>PreSonus PRM1</strong> measurement mic to a spare channel</li>
          <li>Enable <strong>48V phantom power</strong> for that channel</li>
          <li>Position PRM1 at typical audience/performer position</li>
          <li>On QuPac, open <strong>RTA</strong> (Real-Time Analyzer)</li>
          <li>Slowly raise the PRM1 channel gain until you hear ringing</li>
          <li>Watch RTA for sustained peaks - these are feedback frequencies</li>
          <li>Cut those frequencies on <strong>LR GEQ</strong> (Graphic EQ on LR output)</li>
          <li>Repeat until you have 6-10 dB headroom above performance level</li>
        </ol>
      </div>

      <div className="info-box">
        <h4>Why Use PRM1 Instead of Beta 58?</h4>
        <p>The Beta 58A is supercardioid - great for rejecting stage noise during performance, but during ring-out it misses off-axis reflections and room resonances.</p>
        <p>The PRM1 is omnidirectional with flat response - it captures the true room behavior.</p>
      </div>

      {selectedLocation?.lr_geq_cuts && Object.keys(selectedLocation.lr_geq_cuts).length > 0 && (
        <div className="info-box warning">
          <h4>Previous LR GEQ Cuts at This Venue</h4>
          <div className="previous-cuts">
            {Object.entries(selectedLocation.lr_geq_cuts).map(([freq, cut]) => (
              <span key={freq} className="cut-badge">{freq}: {cut}dB</span>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Start with these cuts, then fine-tune.</p>
        </div>
      )}

      <div className="geq-section">
        <h4>LR GEQ Cuts</h4>
        <p className="help-text">Enter negative dB values for cuts (e.g., -3, -6)</p>
        <div className="geq-grid">
          {geqFrequencies.map(freq => (
            <div key={freq} className="geq-band">
              <label>{freq}</label>
              <input
                type="number"
                className="form-input"
                value={ringOutData.lr_geq_cuts[freq] || ''}
                onChange={(e) => updateGEQ('lr', freq, e.target.value)}
                placeholder="0"
                min="-12"
                max="0"
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={saveGEQToLocation}
        >
          Save GEQ Cuts to Venue
        </button>
        <button
          className="btn btn-primary"
          onClick={() => completePhase(3)}
        >
          Continue to Ring Out Monitors
        </button>
      </div>
    </div>
  )

  // Phase 4: Ring Out Monitors
  const renderPhase4 = () => (
    <div className="phase-content">
      <h2>Phase 4: Ring Out Monitors</h2>
      <p className="phase-description">
        Find and cut feedback frequencies in your monitor wedges.
      </p>

      <div className="instruction-box">
        <h4>Monitor Ring Out Procedure</h4>
        <ol>
          <li>Keep <strong>PRM1</strong> connected from Phase 3</li>
          <li>Turn on <strong>ALL performance mics</strong> at their stage positions</li>
          <li>Route QuPac signal generator (pink noise) to <strong>Monitor output</strong></li>
          <li>Gradually increase monitor level</li>
          <li>Watch RTA for sustained peaks</li>
          <li>Cut those frequencies on <strong>Monitor GEQ</strong></li>
          <li>Repeat until clean at performance level + headroom</li>
        </ol>
      </div>

      <div className="info-box">
        <h4>Why Both PRM1 and Performance Mics?</h4>
        <p>Using PRM1 alongside the performance mics ensures you catch all problem frequencies - both what the room does AND what the performer mics will pick up from the monitors.</p>
      </div>

      {selectedLocation?.monitor_geq_cuts && Object.keys(selectedLocation.monitor_geq_cuts).length > 0 && (
        <div className="info-box warning">
          <h4>Previous Monitor GEQ Cuts at This Venue</h4>
          <div className="previous-cuts">
            {Object.entries(selectedLocation.monitor_geq_cuts).map(([freq, cut]) => (
              <span key={freq} className="cut-badge">{freq}: {cut}dB</span>
            ))}
          </div>
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Start with these cuts, then fine-tune.</p>
        </div>
      )}

      <div className="geq-section">
        <h4>Monitor GEQ Cuts</h4>
        <p className="help-text">Enter negative dB values for cuts (e.g., -3, -6)</p>
        <div className="geq-grid">
          {geqFrequencies.map(freq => (
            <div key={freq} className="geq-band">
              <label>{freq}</label>
              <input
                type="number"
                className="form-input"
                value={ringOutData.monitor_geq_cuts[freq] || ''}
                onChange={(e) => updateGEQ('monitor', freq, e.target.value)}
                placeholder="0"
                min="-12"
                max="0"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="info-box" style={{ marginTop: '1rem', background: '#fef3c7', borderColor: '#f59e0b' }}>
        <h4>Important: Switch Mics Now!</h4>
        <p>Disconnect the PRM1 measurement mic. From now on, use only your <strong>performance mics</strong> (Beta 58A, Beta 57A, etc.) for soundcheck.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={saveGEQToLocation}
        >
          Save GEQ Cuts to Venue
        </button>
        <button
          className="btn btn-primary"
          onClick={() => completePhase(4)}
        >
          Continue to Soundcheck
        </button>
      </div>
    </div>
  )

  // Phase 5: Soundcheck
  const renderPhase5 = () => (
    <div className="phase-content">
      <h2>Phase 5: Soundcheck</h2>
      <p className="phase-description">
        Enter your performers and generate QuPac setup instructions.
      </p>

      <div className="form-group">
        <label className="form-label">Event Name</label>
        <input
          type="text"
          className="form-input"
          value={eventData.event_name}
          onChange={(e) => setEventData({ ...eventData, event_name: e.target.value })}
          placeholder="Sunday Service, Concert, etc."
        />
      </div>

      <div className="form-group">
        <label className="form-label">Event Date</label>
        <input
          type="date"
          className="form-input"
          value={eventData.event_date}
          onChange={(e) => setEventData({ ...eventData, event_date: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Performers *</label>
        {eventData.performers.map((performer, index) => (
          <div key={index} className="performer-row">
            <select
              className="form-select"
              value={performer.type}
              onChange={(e) => updatePerformer(index, 'type', e.target.value)}
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
              onChange={(e) => updatePerformer(index, 'count', parseInt(e.target.value) || 1)}
              min="1"
              style={{ width: '70px' }}
            />
            <input
              type="text"
              className="form-input"
              value={performer.notes}
              onChange={(e) => updatePerformer(index, 'notes', e.target.value)}
              placeholder="Notes"
            />
            {eventData.performers.length > 1 && (
              <button
                type="button"
                onClick={() => removePerformer(index)}
                className="btn btn-danger"
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

      <div className="instruction-box">
        <h4>Per-Channel Soundcheck Order</h4>
        <p>For each performer, work through in this order:</p>
        <ol>
          <li><strong>HPF</strong> - Set high-pass filter to remove rumble</li>
          <li><strong>EQ</strong> - Shape tone (cut mud, add presence)</li>
          <li><strong>Compression</strong> - Control dynamics</li>
          <li><strong>FX Send</strong> - Add reverb to taste</li>
        </ol>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>Work with whoever is ready first. Ideally process each channel in isolation.</p>
      </div>

      <button
        className="btn btn-primary btn-large"
        onClick={generateSetup}
        disabled={loading || eventData.performers.filter(p => p.type).length === 0}
      >
        {loading ? 'Generating...' : 'Generate QuPac Setup Instructions'}
      </button>
    </div>
  )

  // Phase 6: Final Mix
  const renderPhase6 = () => (
    <div className="phase-content">
      <h2>Phase 6: Final Mix</h2>
      <p className="phase-description">
        Balance your mix and do a final run-through with all performers.
      </p>

      {generatedSetupId && (
        <div className="info-box success">
          <h4>Setup Generated Successfully!</h4>
          <p>Your QuPac setup instructions are ready.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/setup/${generatedSetupId}`)}
            style={{ marginTop: '0.5rem' }}
          >
            View Setup Instructions
          </button>
        </div>
      )}

      <div className="instruction-box">
        <h4>Final Mix Checklist</h4>
        <ol>
          <li>Balance fader levels in LR mix</li>
          <li>Fine-tune FX return levels</li>
          <li>Adjust monitor sends for each performer</li>
          <li>Full run-through with all performers</li>
          <li>Make final adjustments based on the run-through</li>
        </ol>
      </div>

      <div className="instruction-box">
        <h4>After the Event</h4>
        <p>Don't forget to:</p>
        <ul>
          <li>Rate how well the setup worked (1-5 stars)</li>
          <li>Add notes about what worked and what didn't</li>
          <li>This helps improve future recommendations!</li>
        </ul>
      </div>

      <button
        className="btn btn-primary"
        onClick={() => navigate('/history')}
      >
        Go to Setup History
      </button>
    </div>
  )

  return (
    <>
      <Navigation />
      <div className="container">
        <h1 style={{ marginBottom: '1rem' }}>Event Setup Wizard</h1>

        {/* Loading Overlay */}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-content">
              <div className="loading-spinner"></div>
              <p className="loading-message">{loadingMessage}</p>
              <p className="loading-tip">This typically takes 15-45 seconds</p>
            </div>
          </div>
        )}

        {/* Phase Progress */}
        <div className="phase-progress">
          {PHASES.map((phase) => (
            <div
              key={phase.id}
              className={`phase-step ${currentPhase === phase.id ? 'active' : ''} ${phaseCompleted[phase.id] ? 'completed' : ''}`}
              onClick={() => goToPhase(phase.id)}
            >
              <div className="phase-icon">
                {phaseCompleted[phase.id] ? '✓' : phase.icon}
              </div>
              <div className="phase-name">{phase.name}</div>
            </div>
          ))}
        </div>

        {/* Phase Content */}
        <div className="card">
          {renderPhaseContent()}
        </div>
      </div>

      <style>{`
        .phase-progress {
          display: flex;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
        }

        .phase-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
          min-width: 80px;
        }

        .phase-step.active,
        .phase-step.completed {
          opacity: 1;
        }

        .phase-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          margin-bottom: 0.5rem;
        }

        .phase-step.active .phase-icon {
          background: #3b82f6;
          border-color: #3b82f6;
          color: white;
        }

        .phase-step.completed .phase-icon {
          background: #10b981;
          border-color: #10b981;
          color: white;
        }

        .phase-name {
          font-size: 0.75rem;
          text-align: center;
          color: var(--text-secondary);
        }

        .phase-step.active .phase-name {
          color: var(--text-primary);
          font-weight: 500;
        }

        .phase-content h2 {
          margin-bottom: 0.5rem;
        }

        .phase-description {
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .instruction-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .instruction-box h4 {
          color: #1e40af;
          margin-bottom: 0.75rem;
        }

        .instruction-box ol,
        .instruction-box ul {
          margin: 0;
          padding-left: 1.25rem;
        }

        .instruction-box li {
          margin-bottom: 0.5rem;
        }

        .info-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 0.5rem;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .info-box h4 {
          margin-bottom: 0.5rem;
        }

        .info-box.warning {
          background: #fef3c7;
          border-color: #f59e0b;
        }

        .info-box.success {
          background: #d1fae5;
          border-color: #10b981;
        }

        .checklist {
          margin-bottom: 1.5rem;
        }

        .checklist h4 {
          margin-bottom: 1rem;
        }

        .checklist-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem;
          background: var(--bg-secondary);
          border-radius: 0.5rem;
          margin-bottom: 0.5rem;
          cursor: pointer;
        }

        .checklist-item input[type="checkbox"] {
          margin-top: 0.25rem;
          width: 18px;
          height: 18px;
        }

        .checklist-item span {
          flex: 1;
        }

        .geq-section {
          margin-bottom: 1rem;
        }

        .geq-section h4 {
          margin-bottom: 0.25rem;
        }

        .help-text {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 0.75rem;
        }

        .geq-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .geq-band {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .geq-band label {
          font-size: 0.7rem;
          color: var(--text-secondary);
          margin-bottom: 0.25rem;
        }

        .geq-band input {
          width: 50px;
          text-align: center;
          padding: 0.3rem;
        }

        .previous-cuts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .cut-badge {
          background: rgba(0,0,0,0.1);
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .performer-row {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          flex-wrap: wrap;
        }

        .performer-row .form-select,
        .performer-row .form-input {
          flex: 1;
          min-width: 120px;
        }

        .btn-large {
          padding: 1rem 2rem;
          font-size: 1.1rem;
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

        @media (max-width: 600px) {
          .phase-progress {
            gap: 0.25rem;
          }

          .phase-step {
            min-width: 60px;
          }

          .phase-icon {
            width: 32px;
            height: 32px;
            font-size: 0.85rem;
          }

          .phase-name {
            font-size: 0.65rem;
          }

          .performer-row {
            flex-direction: column;
          }

          .performer-row > * {
            width: 100% !important;
            min-width: 100% !important;
          }
        }
      `}</style>
    </>
  )
}

export default EventWizard
