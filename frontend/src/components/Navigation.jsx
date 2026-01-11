import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function Navigation() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="nav-brand">SERunner</Link>
        <ul className="nav-links">
          <li>
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/generate" className={`nav-link ${isActive('/generate') ? 'active' : ''}`}>
              Generate
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
          <li>
            <button onClick={handleLogout} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
              Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Navigation
