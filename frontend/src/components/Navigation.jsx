import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import WhatsNew from './WhatsNew'

function Navigation() {
  const { logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [versionInfo, setVersionInfo] = useState(null)

  useEffect(() => {
    // Load version info for the badge (cache-busted for PWA freshness)
    fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setVersionInfo(data))
      .catch(() => setVersionInfo(null))
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
    <nav className="nav">
      <div className="nav-container">
        <div className="nav-brand-wrapper">
          <Link to="/" className="nav-brand">SERunner</Link>
          {versionInfo && (
            <button 
              className="version-btn" 
              onClick={() => setShowWhatsNew(true)}
              title="View recent changes"
            >
              v{versionInfo.commitHash}
            </button>
          )}
        </div>
        <ul className="nav-links">
          <li>
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/event" className={`nav-link ${isActive('/event') ? 'active' : ''}`}>
              Event
            </Link>
          </li>
          <li>
            <Link to="/generate" className={`nav-link ${isActive('/generate') ? 'active' : ''}`}>
              Quick
            </Link>
          </li>
          <li>
            <Link to="/locations" className={`nav-link ${isActive('/locations') ? 'active' : ''}`}>
              Locations
            </Link>
          </li>
          <li>
            <Link to="/history" className={`nav-link ${isActive('/history') ? 'active' : ''}`}>
              History
            </Link>
          </li>
          <li>
            <Link to="/gear" className={`nav-link ${isActive('/gear') ? 'active' : ''}`}>
              Gear
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link to="/admin/users" className={`nav-link ${isActive('/admin/users') ? 'active' : ''}`}>
                Users
              </Link>
            </li>
          )}
          <li>
            <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
              Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>

    <WhatsNew isOpen={showWhatsNew} onClose={() => setShowWhatsNew(false)} />

    <style>{`
      .nav-brand-wrapper {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .version-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 0.2rem 0.5rem;
        border-radius: 0.75rem;
        font-size: 0.7rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        font-family: monospace;
      }

      .version-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      }

      @media (max-width: 768px) {
        .version-btn {
          display: none;
        }
      }
    `}</style>
    </>
  )
}

export default Navigation
