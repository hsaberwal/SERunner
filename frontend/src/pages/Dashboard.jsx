import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Navigation from '../components/Navigation'

function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <>
      <Navigation />
      <div className="container">
        <h1 style={{ marginBottom: '2rem' }}>Welcome, {user?.email}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <Link to="/generate" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Generate Setup</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Create a new QuPac mixer setup for your event</p>
            </div>
          </Link>

          <Link to="/locations" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Locations</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Manage your venues and saved locations</p>
            </div>
          </Link>

          <Link to="/history" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Setup History</h2>
              <p style={{ color: 'var(--text-secondary)' }}>View and rate past setups</p>
            </div>
          </Link>

          <Link to="/gear" style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform 0.2s' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Gear</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Manage your equipment inventory</p>
            </div>
          </Link>
        </div>
      </div>
    </>
  )
}

export default Dashboard
