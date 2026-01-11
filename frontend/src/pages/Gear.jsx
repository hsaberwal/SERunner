import { useState, useEffect } from 'react'
import { gear } from '../services/api'
import Navigation from '../components/Navigation'

function Gear() {
  const [gearList, setGearList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    type: 'mic',
    brand: '',
    model: '',
  })

  useEffect(() => {
    loadGear()
  }, [])

  const loadGear = async () => {
    try {
      const response = await gear.getAll()
      setGearList(response.data)
    } catch (error) {
      console.error('Failed to load gear:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await gear.create(formData)
      setShowForm(false)
      setFormData({ type: 'mic', brand: '', model: '' })
      loadGear()
    } catch (error) {
      console.error('Failed to create gear:', error)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Delete this gear item?')) {
      try {
        await gear.delete(id)
        loadGear()
      } catch (error) {
        console.error('Failed to delete gear:', error)
      }
    }
  }

  const groupedGear = gearList.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = []
    }
    acc[item.type].push(item)
    return acc
  }, {})

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <Navigation />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Gear Inventory</h1>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : 'Add Gear'}
          </button>
        </div>

        {showForm && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="card-header">New Gear</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Type *</label>
                <select
                  className="form-select"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                >
                  <option value="mic">Microphone</option>
                  <option value="mixer">Mixer</option>
                  <option value="speaker">Speaker</option>
                  <option value="cable">Cable</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Brand *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Model *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary">Add Gear</button>
            </form>
          </div>
        )}

        {Object.keys(groupedGear).length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            No gear items yet. Add your equipment to get started.
          </p>
        ) : (
          Object.entries(groupedGear).map(([type, items]) => (
            <div key={type} style={{ marginBottom: '2rem' }}>
              <h2 style={{ marginBottom: '1rem', textTransform: 'capitalize' }}>{type}s</h2>
              {items.map((item) => (
                <div key={item.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem' }}>{item.brand} {item.model}</h3>
                    </div>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(item.id)}
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default Gear
