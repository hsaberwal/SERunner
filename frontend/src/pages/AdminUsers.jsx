import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { admin, billing } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import Navigation from '../components/Navigation'

function AdminUsers() {
  const [users, setUsers] = useState([])
  const [subscriptions, setSubscriptions] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, pending, approved
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', password: '', plan: 'free' })
  const [creating, setCreating] = useState(false)
  const [changingPlan, setChangingPlan] = useState(null)
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      return
    }
    loadData()
  }, [isAdmin, navigate])

  const loadData = async () => {
    try {
      const [usersRes, subsRes] = await Promise.all([
        admin.getUsers(),
        billing.getAdminSubscriptions().catch(() => ({ data: [] }))
      ])
      setUsers(usersRes.data)
      // Build a lookup by user email
      const subsMap = {}
      for (const sub of subsRes.data) {
        subsMap[sub.email] = sub
      }
      setSubscriptions(subsMap)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    try {
      await admin.approveUser(userId)
      loadData()
    } catch (error) {
      alert('Failed to approve user: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleReject = async (userId) => {
    if (confirm('Reject and delete this user? This cannot be undone.')) {
      try {
        await admin.rejectUser(userId)
        loadData()
      } catch (error) {
        alert('Failed to reject user: ' + (error.response?.data?.detail || error.message))
      }
    }
  }

  const handleRevoke = async (userId) => {
    if (confirm('Revoke access for this user? They will need to be re-approved to log in.')) {
      try {
        await admin.revokeUser(userId)
        loadData()
      } catch (error) {
        alert('Failed to revoke access: ' + (error.response?.data?.detail || error.message))
      }
    }
  }

  const handleToggleAdmin = async (userId) => {
    try {
      await admin.toggleAdmin(userId)
      loadData()
    } catch (error) {
      alert('Failed to toggle admin: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUser.email || !newUser.password) {
      alert('Email and password are required')
      return
    }
    if (newUser.password.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }

    setCreating(true)
    try {
      await admin.createUser(newUser)
      setNewUser({ email: '', password: '', plan: 'free' })
      setShowAddUser(false)
      loadData()
    } catch (error) {
      alert('Failed to create user: ' + (error.response?.data?.detail || error.message))
    } finally {
      setCreating(false)
    }
  }

  const handleChangePlan = async (userId, newPlan) => {
    setChangingPlan(userId)
    try {
      await billing.adminSetPlan(userId, newPlan)
      loadData()
    } catch (error) {
      alert('Failed to change plan: ' + (error.response?.data?.detail || error.message))
    } finally {
      setChangingPlan(null)
    }
  }

  const filteredUsers = users.filter(u => {
    if (filter === 'pending') return !u.is_approved
    if (filter === 'approved') return u.is_approved
    return true
  })

  const pendingCount = users.filter(u => !u.is_approved).length

  if (loading) {
    return (
      <>
        <Navigation />
        <div className="container"><div className="loading">Loading...</div></div>
      </>
    )
  }

  return (
    <>
      <Navigation />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>User Management</h1>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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
            <button
              className="btn btn-primary"
              onClick={() => setShowAddUser(!showAddUser)}
            >
              {showAddUser ? 'Cancel' : '+ Add User'}
            </button>
          </div>
        </div>

        {/* Add User Form */}
        {showAddUser && (
          <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--primary)' }}>
            <h3 style={{ marginBottom: '1rem' }}>Create New User</h3>
            <form onSubmit={handleCreateUser}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={newUser.email}
                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Password</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newUser.password}
                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Plan</label>
                  <select
                    className="form-input"
                    value={newUser.plan}
                    onChange={e => setNewUser({ ...newUser, plan: e.target.value })}
                  >
                    <option value="free">Free (2 gen/month)</option>
                    <option value="basic">Basic (15 gen/month)</option>
                    <option value="pro">Pro (Unlimited)</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                User will be pre-approved and can log in immediately. Share the credentials with them.
              </p>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        )}

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
          filteredUsers.map((u) => {
            const sub = subscriptions[u.email]
            const currentPlan = sub?.plan || 'free'
            const genUsed = sub?.generations_used || 0
            const genLimit = sub?.generation_limit
            const learnUsed = sub?.learning_used || 0
            const learnLimit = sub?.learning_limit

            return (
              <div key={u.id} className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                      {u.email}
                      {u.id === user?.id && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>(you)</span>
                      )}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        color: u.is_approved ? 'var(--success)' : 'var(--warning)'
                      }}>
                        {u.is_approved ? 'Approved' : 'Pending'}
                      </span>
                      {u.is_admin && (
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Admin</span>
                      )}
                      <span className={`plan-badge plan-badge-${currentPlan}`}>
                        {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                      </span>
                      <span style={{ fontSize: '0.8rem' }}>
                        Gen: {genUsed}/{genLimit === 'unlimited' ? '\u221E' : genLimit}
                        {' | '}
                        Learn: {learnUsed}/{learnLimit === 'unlimited' ? '\u221E' : learnLimit}
                      </span>
                      <span>Registered: {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Plan selector */}
                    {u.is_approved && u.id !== user?.id && (
                      <select
                        className="form-input"
                        value={currentPlan}
                        onChange={e => handleChangePlan(u.id, e.target.value)}
                        disabled={changingPlan === u.id}
                        style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem', width: 'auto', minWidth: '100px' }}
                      >
                        <option value="free">Free</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}

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
                              Revoke
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

export default AdminUsers
