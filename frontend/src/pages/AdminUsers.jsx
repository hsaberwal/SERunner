import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import Navigation from '../components/Navigation'

function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, approved
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    loadUsers()
  }, [isAdmin, navigate])

  const loadUsers = async () => {
    try {
      const response = await admin.getUsers()
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    try {
      await admin.approveUser(userId)
      loadUsers()
    } catch (error) {
      alert('Failed to approve user: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleReject = async (userId) => {
    if (confirm('Reject and delete this user? This cannot be undone.')) {
      try {
        await admin.rejectUser(userId)
        loadUsers()
      } catch (error) {
        alert('Failed to reject user: ' + (error.response?.data?.detail || error.message))
      }
    }
  }

  const handleRevoke = async (userId) => {
    if (confirm('Revoke access for this user? They will need to be re-approved to log in.')) {
      try {
        await admin.revokeUser(userId)
        loadUsers()
      } catch (error) {
        alert('Failed to revoke access: ' + (error.response?.data?.detail || error.message))
      }
    }
  }

  const handleToggleAdmin = async (userId) => {
    try {
      await admin.toggleAdmin(userId)
      loadUsers()
    } catch (error) {
      alert('Failed to toggle admin: ' + (error.response?.data?.detail || error.message))
    }
  }

  const filteredUsers = users.filter(u => {
    if (filter === 'pending') return !u.is_approved
    if (filter === 'approved') return u.is_approved
    return true
  })

  const pendingCount = users.filter(u => !u.is_approved).length

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <Navigation />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>User Management</h1>
          {pendingCount > 0 && (
            <span style={{
              background: 'var(--warning)',
              color: 'white',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
              fontSize: '0.875rem'
            }}>
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
            style={{ padding: '0.5rem 1rem' }}
          >
            All ({users.length})
          </button>
          <button
            className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('pending')}
            style={{ padding: '0.5rem 1rem' }}
          >
            Pending ({pendingCount})
          </button>
          <button
            className={`btn ${filter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('approved')}
            style={{ padding: '0.5rem 1rem' }}
          >
            Approved ({users.length - pendingCount})
          </button>
        </div>

        {filteredUsers.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
            {filter === 'pending' ? 'No pending users.' : 'No users found.'}
          </p>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.id} className="card" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                    {u.email}
                    {u.id === user?.id && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>(you)</span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    <span style={{
                      color: u.is_approved ? 'var(--success)' : 'var(--warning)'
                    }}>
                      {u.is_approved ? 'Approved' : 'Pending'}
                    </span>
                    {u.is_admin && (
                      <span style={{ color: 'var(--primary)' }}>Admin</span>
                    )}
                    <span>Registered: {new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!u.is_approved ? (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleApprove(u.id)}
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleReject(u.id)}
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <>
                      {u.id !== user?.id && (
                        <>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleToggleAdmin(u.id)}
                            style={{ padding: '0.5rem 1rem' }}
                          >
                            {u.is_admin ? 'Remove Admin' : 'Make Admin'}
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleRevoke(u.id)}
                            style={{ padding: '0.5rem 1rem' }}
                          >
                            Revoke Access
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

export default AdminUsers
