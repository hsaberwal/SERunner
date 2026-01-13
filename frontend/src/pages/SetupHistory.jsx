import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { setups, auth } from '../services/api'
import Navigation from '../components/Navigation'

function SetupHistory() {
  const [setupList, setSetupList] = useState([])
  const [sharedSetups, setSharedSetups] = useState([])
  const [allSetups, setAllSetups] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('my') // 'my', 'shared', 'all'
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load user info and setups in parallel
      const [userResponse, mySetupsResponse, sharedResponse] = await Promise.all([
        auth.me(),
        setups.getAll(),
        setups.getShared()
      ])

      setIsAdmin(userResponse.data.is_admin || false)
      setSetupList(mySetupsResponse.data)
      setSharedSetups(sharedResponse.data)

      // If admin, also load all setups
      if (userResponse.data.is_admin) {
        const allResponse = await setups.getAllAdmin()
        setAllSetups(allResponse.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
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

  // Get the current list based on active tab
  const getCurrentList = () => {
    switch (activeTab) {
      case 'shared':
        return sharedSetups
      case 'all':
        return allSetups
      default:
        return setupList
    }
  }

  const currentList = getCurrentList()

  return (
    <>
      <Navigation />
      <div className="container">
        <h1 style={{ marginBottom: '1rem' }}>Setup History</h1>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button
            className={`tab ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            My Setups ({setupList.length})
          </button>
          <button
            className={`tab ${activeTab === 'shared' ? 'active' : ''}`}
            onClick={() => setActiveTab('shared')}
          >
            Shared ({sharedSetups.length})
          </button>
          {isAdmin && (
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Users ({allSetups.length})
            </button>
          )}
        </div>

        {currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              {activeTab === 'my'
                ? 'No setups yet. Generate your first setup to get started.'
                : activeTab === 'shared'
                ? 'No shared setups available.'
                : 'No setups from any users.'}
            </p>
            {activeTab === 'my' && (
              <Link to="/generate" className="btn btn-primary">
                Generate Setup
              </Link>
            )}
          </div>
        ) : (
          <div>
            {currentList.map((setup) => (
              <Link
                key={setup.id}
                to={`/setup/${setup.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>
                          {setup.event_name || 'Unnamed Event'}
                        </h3>
                        {setup.is_shared && activeTab === 'my' && (
                          <span className="shared-badge">Shared</span>
                        )}
                        {setup.owner_name && (activeTab === 'shared' || activeTab === 'all') && (
                          <span className="owner-badge">by {setup.owner_name}</span>
                        )}
                      </div>
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

      <style>{`
        .tabs {
          display: flex;
          gap: 0.5rem;
          border-bottom: 2px solid var(--border-color);
          padding-bottom: 0;
        }

        .tab {
          padding: 0.75rem 1.25rem;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          cursor: pointer;
          font-size: 0.95rem;
          color: var(--text-secondary);
          transition: all 0.2s;
        }

        .tab:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }

        .tab.active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
          font-weight: 500;
        }

        .shared-badge {
          font-size: 0.7rem;
          padding: 0.2rem 0.5rem;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 9999px;
          font-weight: 500;
        }

        .owner-badge {
          font-size: 0.8rem;
          color: var(--text-secondary);
          font-style: italic;
        }
      `}</style>
    </>
  )
}

export default SetupHistory
