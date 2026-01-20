import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { locations, setups, gear } from '../services/api'
import Navigation from '../components/Navigation'
import LocationForm, { getEmptyLocationData, geqFrequencies, emptyPEQ, peqWidthOptions } from '../components/LocationForm'

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
  const [gearList, setGearList] = useState([])
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
    monitor_geq_cuts: {},
    lr_peq: { ...emptyPEQ },
    monitor_peq: { ...emptyPEQ }
  })

  // External RTA verification state
  const [showExternalRTA, setShowExternalRTA] = useState(false)

  // Smart matching state
  const [matchingSetup, setMatchingSetup] = useState(null)
  const [checkingMatch, setCheckingMatch] = useState(false)
  const [reusingSetup, setReusingSetup] = useState(false)

  useEffect(() => {
    loadLocations()
    loadGear()
  }, [])

  const loadGear = async () => {
    try {
      const response = await gear.getAll()
      setGearList(response.data)
    } catch (error) {
      console.error('Failed to load gear:', error)
    }
  }

  // Get microphones from gear inventory
  const microphones = gearList.filter(g => g.type === 'mic')
  // Get DI boxes from gear inventory
  const diBoxes = gearList.filter(g => g.type === 'di_box')

  // Get display name for gear item
  const getGearDisplayName = (item) => {
    return `${item.brand || ''} ${item.model || ''}`.trim() || 'Unknown'
  }

  // Generate a unique key for each gear item
  const getGearKey = (item) => {
    const displayName = `${item.brand || ''} ${item.model || ''}`.trim()
    return displayName || `gear_${item.id}`
  }

  // Find a mic in inventory that matches certain keywords
  const findMicByKeywords = (keywords) => {
    for (const mic of microphones) {
      const fullName = getGearDisplayName(mic).toLowerCase()
      for (const keyword of keywords) {
        if (fullName.includes(keyword.toLowerCase())) {
          return getGearKey(mic)
        }
      }
    }
    return microphones.length > 0 ? getGearKey(microphones[0]) : ''
  }

  useEffect(() => {
    // When location changes, load its existing GEQ/PEQ cuts
    if (selectedLocation) {
      setRingOutData({
        lr_geq_cuts: selectedLocation.lr_geq_cuts || {},
        monitor_geq_cuts: selectedLocation.monitor_geq_cuts || {},
        lr_peq: selectedLocation.lr_peq || { ...emptyPEQ },
        monitor_peq: selectedLocation.monitor_peq || { ...emptyPEQ }
      })
    }
  }, [selectedLocation])

  // Check for matching setups when location or performers change (Phase 5)
  const checkForMatchingSetup = useCallback(async () => {
    // Only check if we have a location and at least one valid performer
    const validPerformers = eventData.performers.filter(p => p.type)
    if (!eventData.location_id || validPerformers.length === 0) {
      setMatchingSetup(null)
      return
    }

    setCheckingMatch(true)
    try {
      const response = await setups.checkMatch({
        location_id: eventData.location_id,
        performers: validPerformers
      })
      setMatchingSetup(response.data)
    } catch (error) {
      console.error('Failed to check for matching setup:', error)
      setMatchingSetup(null)
    } finally {
      setCheckingMatch(false)
    }
  }, [eventData.location_id, eventData.performers])

  // Debounce the match check
  useEffect(() => {
    // Only check when in Phase 5 (Soundcheck)
    if (currentPhase !== 5) return

    const timer = setTimeout(() => {
      checkForMatchingSetup()
    }, 500)
    return () => clearTimeout(timer)
  }, [checkForMatchingSetup, currentPhase])

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

  const updatePEQ = (type, band, field, value) => {
    const key = type === 'lr' ? 'lr_peq' : 'monitor_peq'
    setRingOutData({
      ...ringOutData,
      [key]: {
        ...ringOutData[key],
        [band]: {
          ...ringOutData[key][band],
          [field]: value
        }
      }
    })
  }

  const saveGEQToLocation = async () => {
    if (!selectedLocation) return
    try {
      // Check if PEQ has any data
      const hasPEQData = (peq) => {
        if (!peq) return false
        return Object.values(peq).some(band => band.freq || band.gain)
      }

      await locations.update(selectedLocation.id, {
        ...selectedLocation,
        lr_geq_cuts: Object.keys(ringOutData.lr_geq_cuts).length > 0 ? ringOutData.lr_geq_cuts : null,
        monitor_geq_cuts: Object.keys(ringOutData.monitor_geq_cuts).length > 0 ? ringOutData.monitor_geq_cuts : null,
        lr_peq: hasPEQData(ringOutData.lr_peq) ? ringOutData.lr_peq : null,
        monitor_peq: hasPEQData(ringOutData.monitor_peq) ? ringOutData.monitor_peq : null
      })
      // Refresh location data
      const response = await locations.getAll()
      setLocationList(response.data)
      const updated = response.data.find(l => l.id === selectedLocation.id)
      setSelectedLocation(updated)
    } catch (error) {
      console.error('Failed to save GEQ/PEQ cuts:', error)
    }
  }

  // Get default input source based on performer type
  const getDefaultInputSource = (performerType) => {
    const piezoTypes = ['acoustic_guitar', 'rabab', 'dilruba', 'taus', 'violin', 'sarangi']
    const vocalTypes = ['vocal_female', 'vocal_male']
    const speechTypes = ['podium', 'ardas', 'palki']
    const directTypes = ['keyboard']
    const instrumentTypes = ['tabla', 'flute', 'harmonium']

    // For piezo instruments, prefer DI box
    if (piezoTypes.includes(performerType)) {
      if (diBoxes.length > 0) {
        return getGearKey(diBoxes[0])
      }
      return 'di_piezo'
    }

    // For direct input instruments
    if (directTypes.includes(performerType)) return 'direct'

    // For vocals, try to find Beta 58A or similar vocal mic
    if (vocalTypes.includes(performerType) || speechTypes.includes(performerType)) {
      const vocalMic = findMicByKeywords(['58', 'vocal', 'sm58', 'e835', 'e945'])
      if (vocalMic) return vocalMic
    }

    // For instruments, try to find Beta 57A or similar instrument mic
    if (instrumentTypes.includes(performerType)) {
      const instrumentMic = findMicByKeywords(['57', 'instrument', 'sm57', 'e906', 'c1000'])
      if (instrumentMic) return instrumentMic
    }

    // Fallback: return first available mic
    return microphones.length > 0 ? getGearKey(microphones[0]) : ''
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

  // Reuse a matching setup instead of generating new
  const handleReuseSetup = async () => {
    if (!matchingSetup?.matching_setup?.id) return

    setReusingSetup(true)
    try {
      const response = await setups.reuse(matchingSetup.matching_setup.id, {
        location_id: eventData.location_id,
        event_name: eventData.event_name,
        event_date: eventData.event_date,
        performers: eventData.performers.filter(p => p.type)
      })
      setGeneratedSetupId(response.data.id)
      setPhaseCompleted({ ...phaseCompleted, 5: true })
      setCurrentPhase(6)
    } catch (error) {
      alert('Failed to reuse setup: ' + (error.response?.data?.detail || error.message))
    } finally {
      setReusingSetup(false)
    }
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
          <li>On QuPac, go to <strong>Setup &gt; Audio &gt; SigGen</strong></li>
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
        Find and cut feedback frequencies in your main speakers using pink noise and the measurement mic.
      </p>

      <div className="instruction-box" style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
        <h4>🔊 Keep Pink Noise Playing!</h4>
        <p>Pink noise from Phase 2 should <strong>still be playing through LR mains</strong> during ring-out. This provides the consistent signal needed to identify problem frequencies.</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>If you turned it off, re-enable: <strong>Setup &gt; Audio &gt; SigGen &gt; Pink Noise &gt; Route to LR</strong></p>
      </div>

      <div className="instruction-box">
        <h4>Setup for Ring Out</h4>
        <ol>
          <li>Connect <strong>PreSonus PRM1</strong> measurement mic to a spare channel</li>
          <li>Enable <strong>48V phantom power</strong> for that channel</li>
          <li>Position PRM1 at typical audience/performer position</li>
          <li>On Qu-Pad app, select <strong>LR</strong> on the right-hand side (Mix selection)</li>
          <li>Tap <strong>Processing</strong> tab at top, then <strong>GEQ</strong> on left sidebar</li>
          <li>Press <strong>PAFL</strong> button for LR Master - this feeds the RTA display</li>
          <li>Ensure <strong>pink noise is playing</strong> at moderate level through LR</li>
        </ol>
      </div>

      <div className="instruction-box">
        <h4>Ring Out Procedure (QuPac RTA + GEQ)</h4>
        <ol>
          <li><strong>With pink noise playing</strong>, slowly increase the PRM1 channel fader until the system just begins to ring/feedback</li>
          <li><strong>Watch the RTA</strong> display above the GEQ faders - the feedback frequency will show as a significant peak (red/highlighted bar)</li>
          <li><strong>Cut the frequency</strong>: Find the GEQ fader matching the peak, pull it down <strong>3-6 dB</strong></li>
          <li><strong>Repeat</strong>: Continue raising volume to find the next ringing frequency, then cut it</li>
          <li><strong>Stop</strong> when you have 3-5 stable frequency cuts, or have reached desired volume + headroom</li>
        </ol>
      </div>

      <div className="info-box" style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
        <h4>Pro Tips</h4>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
          <li><strong>Pinch technique:</strong> Touch above the fader icons for precise control without obscuring the view</li>
          <li><strong>Narrow feedback:</strong> For very persistent/narrow spikes, use <strong>PEQ</strong> tab instead - set a high Q value to "notch out" the specific frequency</li>
          <li><strong>Save your work:</strong> Save settings as a User Preset in Library to recall for future events at this venue</li>
        </ul>
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
        <h4>LR GEQ Cuts (1/3 Octave - 31 Bands)</h4>
        <p className="help-text">Enter negative dB values for cuts (e.g., -3, -6). Only fill in bands you've cut.</p>
        <div className="geq-grid-full">
          {geqFrequencies.map(freq => (
            <div key={freq} className="geq-band-small">
              <label>{freq}</label>
              <input
                type="number"
                className="form-input"
                value={ringOutData.lr_geq_cuts[freq] || ''}
                onChange={(e) => updateGEQ('lr', freq, e.target.value)}
                placeholder="0"
                min="-12"
                max="12"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="peq-section">
        <h4>LR Parametric EQ (4 Bands)</h4>
        <p className="help-text">For surgical notch cuts that the GEQ can't handle precisely</p>
        <div className="peq-grid">
          {['band1', 'band2', 'band3', 'band4'].map((band, idx) => (
            <div key={band} className="peq-band-row">
              <span className="peq-band-label">Band {idx + 1}</span>
              <input
                type="text"
                className="form-input"
                placeholder="Freq (e.g., 2.5kHz)"
                value={ringOutData.lr_peq[band]?.freq || ''}
                onChange={(e) => updatePEQ('lr', band, 'freq', e.target.value)}
                style={{ width: '100px' }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="dB (e.g., -6)"
                value={ringOutData.lr_peq[band]?.gain || ''}
                onChange={(e) => updatePEQ('lr', band, 'gain', e.target.value)}
                style={{ width: '80px' }}
              />
              <select
                className="form-select"
                value={ringOutData.lr_peq[band]?.width || 'medium'}
                onChange={(e) => updatePEQ('lr', band, 'width', e.target.value)}
                style={{ width: '150px' }}
              >
                {peqWidthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button
          className="btn btn-secondary"
          onClick={saveGEQToLocation}
        >
          Save GEQ/PEQ to Venue
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
        <h4>Setup for Monitor Ring Out</h4>
        <ol>
          <li>Keep <strong>PRM1</strong> connected from Phase 3</li>
          <li>Position PRM1 near the monitor wedge, facing it (where a performer would stand)</li>
          <li>On Qu-Pad, select the <strong>Mix (Aux)</strong> button for your monitor output (e.g., Mix 1)</li>
          <li>Tap <strong>Processing</strong> tab at top, then <strong>GEQ</strong> on left sidebar</li>
          <li>Press <strong>PAFL</strong> button for that Mix Master - this feeds the RTA display</li>
        </ol>
      </div>

      <div className="instruction-box">
        <h4>Ring Out Procedure (Same as Mains)</h4>
        <ol>
          <li><strong>Slowly increase</strong> the Mix Master fader (or PRM1's send-to-mix fader) until the system begins to ring</li>
          <li><strong>Watch the RTA</strong> display above GEQ faders - feedback shows as a significant peak</li>
          <li><strong>Cut the frequency</strong>: Pull the matching GEQ fader down <strong>3-6 dB</strong></li>
          <li><strong>Repeat</strong> until you have 3-5 stable cuts or have reached desired volume</li>
        </ol>
      </div>

      <div className="info-box">
        <h4>Why Use PRM1 for Monitors?</h4>
        <p>The PRM1's omnidirectional pattern captures the true behavior of sound reflecting between the monitor and the performer's position. Performance mics (like Beta 58A) are supercardioid and may miss off-axis room resonances.</p>
      </div>

      <div className="info-box" style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
        <h4>Multiple Monitor Mixes?</h4>
        <p>If you have separate monitor mixes (e.g., Mix 1 for vocalist, Mix 2 for guitarist), repeat this process for <strong>each mix</strong>. Select the appropriate Mix, enable its PAFL, and ring out its GEQ individually.</p>
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
        <h4>Monitor GEQ Cuts (1/3 Octave - 31 Bands)</h4>
        <p className="help-text">Enter negative dB values for cuts (e.g., -3, -6). Only fill in bands you've cut.</p>
        <div className="geq-grid-full">
          {geqFrequencies.map(freq => (
            <div key={freq} className="geq-band-small">
              <label>{freq}</label>
              <input
                type="number"
                className="form-input"
                value={ringOutData.monitor_geq_cuts[freq] || ''}
                onChange={(e) => updateGEQ('monitor', freq, e.target.value)}
                placeholder="0"
                min="-12"
                max="12"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="peq-section">
        <h4>Monitor Parametric EQ (4 Bands)</h4>
        <p className="help-text">For surgical notch cuts that the GEQ can't handle precisely</p>
        <div className="peq-grid">
          {['band1', 'band2', 'band3', 'band4'].map((band, idx) => (
            <div key={band} className="peq-band-row">
              <span className="peq-band-label">Band {idx + 1}</span>
              <input
                type="text"
                className="form-input"
                placeholder="Freq (e.g., 2.5kHz)"
                value={ringOutData.monitor_peq[band]?.freq || ''}
                onChange={(e) => updatePEQ('monitor', band, 'freq', e.target.value)}
                style={{ width: '100px' }}
              />
              <input
                type="text"
                className="form-input"
                placeholder="dB (e.g., -6)"
                value={ringOutData.monitor_peq[band]?.gain || ''}
                onChange={(e) => updatePEQ('monitor', band, 'gain', e.target.value)}
                style={{ width: '80px' }}
              />
              <select
                className="form-select"
                value={ringOutData.monitor_peq[band]?.width || 'medium'}
                onChange={(e) => updatePEQ('monitor', band, 'width', e.target.value)}
                style={{ width: '150px' }}
              >
                {peqWidthOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* External RTA Verification - Collapsible */}
      <div className="external-rta-section" style={{ marginTop: '1.5rem' }}>
        <button
          type="button"
          className="collapsible-header"
          onClick={() => setShowExternalRTA(!showExternalRTA)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            border: '2px solid #3b82f6',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#1e40af'
          }}
        >
          <span>Optional: Verify with External RTA (AudioBox GO + Smaart)</span>
          <span style={{ fontSize: '1.25rem' }}>{showExternalRTA ? '−' : '+'}</span>
        </button>

        {showExternalRTA && (
          <div style={{ padding: '1rem', border: '2px solid #3b82f6', borderTop: 'none', borderRadius: '0 0 0.5rem 0.5rem', background: '#f8fafc' }}>
            <p style={{ marginBottom: '1rem', color: '#475569' }}>
              Use your iPhone/iPad with the PreSonus AudioBox GO and Smaart RTA Pro app to verify the QuPac's built-in RTA was accurate.
            </p>

            <div className="instruction-box" style={{ background: '#fff' }}>
              <h4>Equipment Setup</h4>
              <ol>
                <li><strong>Connect AudioBox GO</strong> to your iPad/iPhone via USB-C cable</li>
                <li>If direct connection has issues, use a USB-C hub with power delivery</li>
                <li>Connect your <strong>PreSonus PRM1</strong> measurement mic to AudioBox GO's XLR input</li>
                <li>Enable <strong>48V phantom power</strong> on the AudioBox GO</li>
                <li>Open <strong>Smaart RTA Pro</strong> app on your device</li>
              </ol>
            </div>

            <div className="instruction-box" style={{ marginTop: '1rem', background: '#fff' }}>
              <h4>Smaart RTA Pro Setup</h4>
              <ol>
                <li>In Smaart, go to <strong>Settings &gt; Audio Input</strong></li>
                <li>Select <strong>AudioBox GO</strong> as input device</li>
                <li>Set input to <strong>Channel 1</strong> (or whichever the PRM1 is connected to)</li>
                <li>Set display to <strong>1/3 Octave</strong> mode for easier comparison to GEQ</li>
                <li>Enable <strong>Peak Hold</strong> to catch transient feedback frequencies</li>
              </ol>
            </div>

            <div className="instruction-box" style={{ marginTop: '1rem', background: '#fff' }}>
              <h4>Verification Procedure</h4>
              <ol>
                <li>Position PRM1 where you had it during QuPac ring-out</li>
                <li>Play <strong>pink noise</strong> through LR mains at ring-out level</li>
                <li>Compare Smaart display to your GEQ cuts above</li>
                <li>If Smaart shows peaks at frequencies you didn't cut, add those cuts</li>
                <li>Gradually increase level and watch for new peaks</li>
                <li>Repeat for <strong>Monitor output</strong></li>
              </ol>
            </div>

            <div className="info-box" style={{ marginTop: '1rem', background: '#ecfdf5', borderColor: '#10b981' }}>
              <h4>Why Verify with External RTA?</h4>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                <li>Smaart has higher frequency resolution than QuPac's built-in RTA</li>
                <li>Second opinion catches frequencies you might have missed</li>
                <li>Better peak detection and hold features</li>
                <li>You can move around the room while monitoring on your phone</li>
              </ul>
            </div>

            <div className="info-box" style={{ marginTop: '1rem', background: '#fef3c7', borderColor: '#f59e0b' }}>
              <h4>Troubleshooting AudioBox GO Connection</h4>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                <li><strong>Not recognized?</strong> First connect to computer and update firmware via Universal Control</li>
                <li><strong>Audio dropouts?</strong> Use a USB-C hub with power delivery passthrough</li>
                <li><strong>No signal?</strong> Check 48V phantom power is ON for condenser mics</li>
                <li><strong>Clipping?</strong> Reduce gain on AudioBox GO (green LED = good, red = too hot)</li>
              </ul>
            </div>
          </div>
        )}
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
              {microphones.length > 0 && (
                <optgroup label="Microphones">
                  {microphones.map((mic) => (
                    <option key={mic.id} value={getGearKey(mic)}>
                      {getGearDisplayName(mic)}
                    </option>
                  ))}
                </optgroup>
              )}
              {diBoxes.length > 0 && (
                <optgroup label="DI Boxes">
                  {diBoxes.map((di) => (
                    <option key={di.id} value={getGearKey(di)}>
                      {getGearDisplayName(di)}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Direct Input">
                <option value="di_piezo">DI Box (Piezo/Generic)</option>
                <option value="direct">Direct / Line In</option>
              </optgroup>
              {microphones.length === 0 && diBoxes.length === 0 && (
                <optgroup label="No gear added">
                  <option value="" disabled>Add mics in Gear page</option>
                </optgroup>
              )}
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

      {/* Matching Setup Suggestion */}
      {matchingSetup?.has_match && matchingSetup?.matching_setup && (
        <div className="matching-setup-banner">
          <div className="match-header">
            <span className="match-icon">&#10003;</span>
            <strong>Similar Setup Found!</strong>
            <span className={`match-quality match-${matchingSetup.match_quality}`}>
              {matchingSetup.match_quality === 'exact' ? 'Exact Match' :
               matchingSetup.match_quality === 'similar' ? 'Similar Match' : 'Partial Match'}
            </span>
          </div>
          <p className="match-details">
            <strong>{matchingSetup.matching_setup.event_name || 'Previous Setup'}</strong>
            {matchingSetup.matching_setup.event_date && (
              <span> from {new Date(matchingSetup.matching_setup.event_date).toLocaleDateString()}</span>
            )}
            {matchingSetup.matching_setup.rating && (
              <span className="match-rating">
                {' '}&bull; Rated {matchingSetup.matching_setup.rating}/5
              </span>
            )}
          </p>
          <p className="match-suggestion">{matchingSetup.suggestion}</p>
          <div className="match-actions">
            <button
              type="button"
              className="btn btn-success"
              onClick={handleReuseSetup}
              disabled={reusingSetup}
            >
              {reusingSetup ? 'Reusing...' : 'Use This Setup (Fast)'}
            </button>
            <span className="match-or">or</span>
            <button
              className="btn btn-secondary"
              onClick={generateSetup}
              disabled={loading || eventData.performers.filter(p => p.type).length === 0}
            >
              Generate New with Claude
            </button>
          </div>
        </div>
      )}

      {/* Show checking indicator */}
      {checkingMatch && (
        <div className="checking-match">
          <span className="checking-spinner"></span>
          Checking for matching setups...
        </div>
      )}

      {/* Only show generate button if no match found */}
      {!matchingSetup?.has_match && (
        <button
          className="btn btn-primary btn-large"
          onClick={generateSetup}
          disabled={loading || checkingMatch || eventData.performers.filter(p => p.type).length === 0}
        >
          {loading ? 'Generating...' : 'Generate QuPac Setup Instructions'}
        </button>
      )}
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

        .geq-grid-full {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
          gap: 0.3rem;
          margin-bottom: 1rem;
        }

        .geq-band-small {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .geq-band-small label {
          font-size: 0.6rem;
          color: var(--text-secondary);
          margin-bottom: 0.15rem;
          white-space: nowrap;
        }

        .geq-band-small input {
          width: 45px;
          text-align: center;
          padding: 0.2rem;
          font-size: 0.8rem;
        }

        .peq-section {
          margin-top: 1.5rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 0.5rem;
        }

        .peq-section h4 {
          margin-bottom: 0.25rem;
        }

        .peq-grid {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .peq-band-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .peq-band-label {
          font-weight: 500;
          min-width: 50px;
          font-size: 0.85rem;
        }

        .peq-band-row input,
        .peq-band-row select {
          font-size: 0.85rem;
          padding: 0.3rem 0.5rem;
        }

        @media (max-width: 500px) {
          .peq-band-row {
            flex-direction: column;
            align-items: flex-start;
          }
          .peq-band-row input,
          .peq-band-row select {
            width: 100% !important;
          }
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

        /* Matching Setup Banner Styles */
        .matching-setup-banner {
          background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
          border: 2px solid #10b981;
          border-radius: 0.75rem;
          padding: 1.25rem;
          margin-bottom: 1.5rem;
        }

        .match-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .match-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          font-size: 14px;
          font-weight: bold;
        }

        .match-quality {
          font-size: 0.75rem;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-weight: 500;
        }

        .match-exact {
          background: #10b981;
          color: white;
        }

        .match-similar {
          background: #3b82f6;
          color: white;
        }

        .match-partial {
          background: #f59e0b;
          color: white;
        }

        .match-details {
          margin: 0 0 0.5rem 0;
          color: #1f2937;
          font-size: 0.95rem;
        }

        .match-rating {
          color: #059669;
          font-weight: 500;
        }

        .match-suggestion {
          margin: 0 0 1rem 0;
          color: #065f46;
          font-size: 0.9rem;
          font-style: italic;
        }

        .match-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .match-or {
          color: #6b7280;
          font-size: 0.85rem;
        }

        .btn-success {
          background: #10b981;
          color: white;
          border: none;
        }

        .btn-success:hover {
          background: #059669;
        }

        .btn-success:disabled {
          background: #6ee7b7;
          cursor: not-allowed;
        }

        /* Checking indicator */
        .checking-match {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #6b7280;
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .checking-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
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
