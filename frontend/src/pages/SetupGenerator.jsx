import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { locations, setups, gear } from '../services/api'
import Navigation from '../components/Navigation'
import LocationForm, { getEmptyLocationData } from '../components/LocationForm'

function SetupGenerator() {
  const navigate = useNavigate()
  const [locationList, setLocationList] = useState([])
  const [gearList, setGearList] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [showNewLocation, setShowNewLocation] = useState(false)
  const [creatingLocation, setCreatingLocation] = useState(false)
  const [formData, setFormData] = useState({
    location_id: '',
    event_name: '',
    event_date: '',
    performers: [{ type: '', count: 1, input_source: '', notes: '' }]
  })
  const [newLocation, setNewLocation] = useState(getEmptyLocationData())

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

  // Generate a unique key for each gear item to use as dropdown value
  // Using display name as the value since it's more readable in Claude prompts
  const getGearKey = (item) => {
    const displayName = `${item.brand || ''} ${item.model || ''}`.trim()
    return displayName || `gear_${item.id}`
  }

  // Get display name for gear item (same as key for clarity)
  const getGearDisplayName = (item) => {
    return `${item.brand || ''} ${item.model || ''}`.trim() || 'Unknown'
  }

  // Check for matching setups when location or performers change
  const checkForMatchingSetup = useCallback(async () => {
    // Only check if we have a location and at least one valid performer
    const validPerformers = formData.performers.filter(p => p.type)
    if (!formData.location_id || validPerformers.length === 0) {
      setMatchingSetup(null)
      return
    }

    setCheckingMatch(true)
    try {
      const response = await setups.checkMatch({
        location_id: formData.location_id,
        performers: validPerformers
      })
      setMatchingSetup(response.data)
    } catch (error) {
      console.error('Failed to check for matching setup:', error)
      setMatchingSetup(null)
    } finally {
      setCheckingMatch(false)
    }
  }, [formData.location_id, formData.performers])

  // Debounce the match check to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForMatchingSetup()
    }, 500)
    return () => clearTimeout(timer)
  }, [checkForMatchingSetup])

  const loadLocations = async () => {
    try {
      const response = await locations.getAll()
      setLocationList(response.data)
    } catch (error) {
      console.error('Failed to load locations:', error)
    }
  }

  const handleCreateLocation = async (cleanedData) => {
    setCreatingLocation(true)
    try {
      const response = await locations.create(cleanedData)
      await loadLocations()
      setFormData({ ...formData, location_id: response.data.id })
      setShowNewLocation(false)
      setNewLocation(getEmptyLocationData())
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

  // Find a mic in inventory that matches certain keywords (for smart defaults)
  const findMicByKeywords = (keywords) => {
    for (const mic of microphones) {
      const fullName = getGearDisplayName(mic).toLowerCase()
      for (const keyword of keywords) {
        if (fullName.includes(keyword.toLowerCase())) {
          return getGearKey(mic)
        }
      }
    }
    // Return first available mic if no match found
    return microphones.length > 0 ? getGearKey(microphones[0]) : ''
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

  // Reuse a matching setup instead of generating new
  const handleReuseSetup = async () => {
    if (!matchingSetup?.matching_setup?.id) return

    setReusingSetup(true)
    try {
      const response = await setups.reuse(matchingSetup.matching_setup.id, {
        location_id: formData.location_id,
        event_name: formData.event_name,
        event_date: formData.event_date,
        performers: formData.performers.filter(p => p.type)
      })
      navigate(`/setup/${response.data.id}`)
    } catch (error) {
      alert('Failed to reuse setup: ' + (error.response?.data?.detail || error.message))
    } finally {
      setReusingSetup(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.location_id) {
      alert('Please select or create a location')
      return
    }

    setLoading(true)
    setLoadingMessage('Preparing your setup request...')

    try {
      // Update loading messages to show progress
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

      const response = await setups.generate(formData)

      // Clear all timers
      clearTimeout(messageTimer)
      clearTimeout(messageTimer2)
      clearTimeout(messageTimer3)
      clearTimeout(messageTimer4)

      navigate(`/setup/${response.data.id}`)
    } catch (error) {
      alert('Failed to generate setup: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  return (
    <>
      <Navigation />
      <div className="container">
        <h1 style={{ marginBottom: '2rem' }}>Quick Generate Setup</h1>

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
                  disabled={creatingLocation}
                />
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
                  <button type="submit" className="btn btn-secondary" disabled={loading || showNewLocation}>
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
              <button type="submit" className="btn btn-primary" disabled={loading || showNewLocation || checkingMatch}>
                {loading ? 'Generating...' : 'Generate Setup'}
              </button>
            )}
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
      `}</style>
    </>
  )
}

export default SetupGenerator
