import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { locations, setups } from '../services/api'
import Navigation from '../components/Navigation'

function SetupGenerator() {
  const navigate = useNavigate()
  const [locationList, setLocationList] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    location_id: '',
    event_name: '',
    event_date: '',
    performers: [{ type: '', count: 1, notes: '' }]
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

  const addPerformer = () => {
    setFormData({
      ...formData,
      performers: [...formData.performers, { type: '', count: 1, notes: '' }]
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
    setFormData({ ...formData, performers: newPerformers })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
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
                value={formData.location_id}
                onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                required
              >
                <option value="">Select location...</option>
                {locationList.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} {loc.is_temporary ? '(Temporary)' : ''}
                  </option>
                ))}
              </select>
            </div>

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
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    className="form-select"
                    value={performer.type}
                    onChange={(e) => updatePerformer(index, 'type', e.target.value)}
                    required
                  >
                    <option value="">Select type...</option>
                    <option value="vocal_female">Female Vocal</option>
                    <option value="vocal_male">Male Vocal</option>
                    <option value="flute">Flute</option>
                    <option value="tabla">Tabla</option>
                    <option value="acoustic_guitar">Acoustic Guitar</option>
                    <option value="harmonium">Harmonium</option>
                    <option value="keyboard">Keyboard</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="number"
                    className="form-input"
                    value={performer.count}
                    onChange={(e) => updatePerformer(index, 'count', parseInt(e.target.value))}
                    min="1"
                    placeholder="Count"
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
                      style={{ padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '0.5rem' }}
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

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Generating...' : 'Generate Setup'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

export default SetupGenerator
