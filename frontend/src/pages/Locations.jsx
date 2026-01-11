import { useState, useEffect } from 'react'
import { locations } from '../services/api'
import Navigation from '../components/Navigation'

function Locations() {
  const [locationList, setLocationList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
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
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await locations.create(formData)
      setShowForm(false)
      setFormData({ name: '', venue_type: '', notes: '', is_temporary: false })
      loadLocations()
    } catch (error) {
      console.error('Failed to create location:', error)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Delete this location?')) {
      try {
        await locations.delete(id)
        loadLocations()
      } catch (error) {
        console.error('Failed to delete location:', error)
      }
    }
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
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Location'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="card-header">New Location</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  <option value="church">Church</option>
                  <option value="hall">Hall</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="school">School</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Speaker placement, acoustic notes, etc."
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_temporary}
                    onChange={(e) => setFormData({ ...formData, is_temporary: e.target.checked })}
                  />
                  Temporary location
                </label>
              </div>

              <button type="submit" className="btn btn-primary">Create Location</button>
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
              <div key={loc.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                      {loc.name}
                      {loc.is_temporary && <span style={{ fontSize: '0.875rem', color: 'var(--warning)', marginLeft: '0.5rem' }}>(Temporary)</span>}
                    </h3>
                    {loc.venue_type && (
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Type: {loc.venue_type}
                      </p>
                    )}
                    {loc.notes && <p style={{ color: 'var(--text-secondary)' }}>{loc.notes}</p>}
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(loc.id)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}

export default Locations
