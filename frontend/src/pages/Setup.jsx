import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../services/api'
import './Setup.css'

function Setup() {
  const [status, setStatus] = useState('checking')
  const [dbStatus, setDbStatus] = useState(null)
  const [error, setError] = useState(null)
  const [initializing, setInitializing] = useState(false)
  const navigate = useNavigate()

  const checkStatus = async () => {
    setStatus('checking')
    setError(null)
    try {
      const response = await admin.dbStatus()
      setDbStatus(response.data)
      if (response.data.status === 'connected' && response.data.tables_count >= 5) {
        setStatus('ready')
      } else if (response.data.status === 'connected') {
        setStatus('needs_init')
      } else {
        setStatus('error')
        setError(response.data.error || 'Unknown error')
      }
    } catch (err) {
      setStatus('error')
      setError(err.response?.data?.detail || err.message || 'Failed to connect to backend')
    }
  }

  const initializeDatabase = async () => {
    setInitializing(true)
    setError(null)
    try {
      const response = await admin.initDb()
      if (response.data.status === 'success') {
        await checkStatus()
      } else {
        setError(response.data.error || 'Failed to initialize database')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to initialize database')
    } finally {
      setInitializing(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="setup-status">
            <div className="spinner"></div>
            <p>Checking system status...</p>
          </div>
        )

      case 'ready':
        return (
          <div className="setup-status success">
            <div className="status-icon">&#10003;</div>
            <h2>System Ready!</h2>
            <p>Database is connected with {dbStatus?.tables_count} tables.</p>
            <div className="tables-list">
              <strong>Tables:</strong> {dbStatus?.tables?.join(', ')}
            </div>
            <button className="btn-primary" onClick={() => navigate('/login')}>
              Continue to Login
            </button>
          </div>
        )

      case 'needs_init':
        return (
          <div className="setup-status warning">
            <div className="status-icon">!</div>
            <h2>Database Setup Required</h2>
            <p>The database is connected but tables need to be created.</p>
            {dbStatus?.tables_count > 0 && (
              <div className="tables-list">
                <strong>Existing tables:</strong> {dbStatus?.tables?.join(', ') || 'None'}
              </div>
            )}
            <button
              className="btn-primary"
              onClick={initializeDatabase}
              disabled={initializing}
            >
              {initializing ? 'Initializing...' : 'Initialize Database'}
            </button>
          </div>
        )

      case 'error':
        return (
          <div className="setup-status error">
            <div className="status-icon">&#10007;</div>
            <h2>Connection Error</h2>
            <p>Could not connect to the backend server.</p>
            {error && <div className="error-message">{error}</div>}
            <button className="btn-secondary" onClick={checkStatus}>
              Retry Connection
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        <div className="setup-header">
          <h1>SERunner Setup</h1>
          <p>Sound Engineering Runner - First Time Setup</p>
        </div>
        {renderContent()}
      </div>
    </div>
  )
}

export default Setup
