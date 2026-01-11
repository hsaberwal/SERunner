import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { setups } from '../services/api'
import Navigation from '../components/Navigation'

function SetupHistory() {
  const [setupList, setSetupList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSetups()
  }, [])

  const loadSetups = async () => {
    try {
      const response = await setups.getAll()
      setSetupList(response.data)
    } catch (error) {
      console.error('Failed to load setups:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderStars = (rating) => {
    if (!rating) return <span style={{ color: 'var(--text-secondary)' }}>Not rated</span>
    return '⭐'.repeat(rating)
  }

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <Navigation />
      <div className="container">
        <h1 style={{ marginBottom: '2rem' }}>Setup History</h1>

        {setupList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              No setups yet. Generate your first setup to get started.
            </p>
            <Link to="/generate" className="btn btn-primary">
              Generate Setup
            </Link>
          </div>
        ) : (
          <div>
            {setupList.map((setup) => (
              <Link
                key={setup.id}
                to={`/setup/${setup.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                        {setup.event_name || 'Unnamed Event'}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        {setup.event_date ? new Date(setup.event_date).toLocaleDateString() : 'No date'}
                      </p>
                      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Performers: {setup.performers.map(p => `${p.count}x ${p.type}`).join(', ')}
                      </p>
                      <div style={{ marginTop: '0.5rem' }}>
                        {renderStars(setup.rating)}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default SetupHistory
