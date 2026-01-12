import { useState, useEffect } from 'react'
import { gear } from '../services/api'
import Navigation from '../components/Navigation'

function Gear() {
  const [gearList, setGearList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showLoanForm, setShowLoanForm] = useState(null) // gear id to loan
  const [formData, setFormData] = useState({
    type: 'mic',
    brand: '',
    model: '',
    serial_number: '',
    quantity: 1,
    notes: '',
  })
  const [loanData, setLoanData] = useState({
    borrower_name: '',
    borrower_contact: '',
    quantity_loaned: 1,
    expected_return_date: '',
    notes: '',
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
      setFormData({ type: 'mic', brand: '', model: '', serial_number: '', quantity: 1, notes: '' })
      loadGear()
    } catch (error) {
      alert('Failed to create gear: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDelete = async (id) => {
    if (confirm('Delete this gear item? This will also delete all loan history.')) {
      try {
        await gear.delete(id)
        loadGear()
      } catch (error) {
        alert('Failed to delete gear: ' + (error.response?.data?.detail || error.message))
      }
    }
  }

  const handleLoanSubmit = async (e, gearId) => {
    e.preventDefault()
    try {
      await gear.createLoan(gearId, {
        ...loanData,
        expected_return_date: loanData.expected_return_date || null,
      })
      setShowLoanForm(null)
      setLoanData({ borrower_name: '', borrower_contact: '', quantity_loaned: 1, expected_return_date: '', notes: '' })
      loadGear()
    } catch (error) {
      alert('Failed to create loan: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleReturn = async (gearId, loanId) => {
    const notes = prompt('Any notes about the return? (condition, issues, etc.)')
    try {
      await gear.returnLoan(gearId, loanId, { return_notes: notes || null })
      loadGear()
    } catch (error) {
      alert('Failed to return loan: ' + (error.response?.data?.detail || error.message))
    }
  }

  const groupedGear = gearList.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = []
    }
    acc[item.type].push(item)
    return acc
  }, {})

  const typeLabels = {
    mic: 'Microphones',
    di_box: 'DI Boxes',
    mixer: 'Mixers',
    speaker: 'Speakers',
    cable: 'Cables',
    stand: 'Stands',
    other: 'Other',
  }

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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    <option value="mic">Microphone</option>
                    <option value="di_box">DI Box</option>
                    <option value="mixer">Mixer</option>
                    <option value="speaker">Speaker</option>
                    <option value="cable">Cable</option>
                    <option value="stand">Stand</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    min="1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brand *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g., Shure, Radial"
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
                    placeholder="e.g., Beta 58A, PZ-DI"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Condition, special handling notes, etc."
                  rows={2}
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
              <h2 style={{ marginBottom: '1rem' }}>{typeLabels[type] || type}</h2>
              {items.map((item) => (
                <div key={item.id} className="card" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                        {item.brand} {item.model}
                        {item.serial_number && <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}> ({item.serial_number})</span>}
                      </h3>
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        <span>Total: {item.quantity}</span>
                        <span style={{ color: item.quantity_available > 0 ? 'var(--success)' : 'var(--danger)' }}>
                          Available: {item.quantity_available}
                        </span>
                        {item.quantity - item.quantity_available > 0 && (
                          <span style={{ color: 'var(--warning)' }}>
                            On Loan: {item.quantity - item.quantity_available}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          {item.notes}
                        </p>
                      )}

                      {/* Active Loans */}
                      {item.active_loans && item.active_loans.length > 0 && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                          <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Active Loans:</h4>
                          {item.active_loans.map((loan) => (
                            <div key={loan.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                              <div>
                                <strong>{loan.borrower_name}</strong>
                                {loan.borrower_contact && <span style={{ color: 'var(--text-secondary)' }}> ({loan.borrower_contact})</span>}
                                <br />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Qty: {loan.quantity_loaned} | Since: {new Date(loan.loan_date).toLocaleDateString()}
                                  {loan.expected_return_date && ` | Due: ${new Date(loan.expected_return_date).toLocaleDateString()}`}
                                </span>
                                {loan.notes && <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0' }}>{loan.notes}</p>}
                              </div>
                              <button
                                className="btn btn-secondary"
                                onClick={() => handleReturn(item.id, loan.id)}
                                style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                              >
                                Return
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                      {item.quantity_available > 0 && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => setShowLoanForm(showLoanForm === item.id ? null : item.id)}
                          style={{ padding: '0.5rem 1rem' }}
                        >
                          Loan Out
                        </button>
                      )}
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDelete(item.id)}
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Loan Form */}
                  {showLoanForm === item.id && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                      <h4 style={{ marginBottom: '1rem' }}>Loan to Someone</h4>
                      <form onSubmit={(e) => handleLoanSubmit(e, item.id)}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div className="form-group">
                            <label className="form-label">Borrower Name *</label>
                            <input
                              type="text"
                              className="form-input"
                              value={loanData.borrower_name}
                              onChange={(e) => setLoanData({ ...loanData, borrower_name: e.target.value })}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Contact (phone/email)</label>
                            <input
                              type="text"
                              className="form-input"
                              value={loanData.borrower_contact}
                              onChange={(e) => setLoanData({ ...loanData, borrower_contact: e.target.value })}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Quantity *</label>
                            <input
                              type="number"
                              className="form-input"
                              value={loanData.quantity_loaned}
                              onChange={(e) => setLoanData({ ...loanData, quantity_loaned: parseInt(e.target.value) || 1 })}
                              min="1"
                              max={item.quantity_available}
                              required
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Expected Return Date</label>
                            <input
                              type="date"
                              className="form-input"
                              value={loanData.expected_return_date}
                              onChange={(e) => setLoanData({ ...loanData, expected_return_date: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Notes</label>
                          <input
                            type="text"
                            className="form-input"
                            value={loanData.notes}
                            onChange={(e) => setLoanData({ ...loanData, notes: e.target.value })}
                            placeholder="Purpose, condition on loan, etc."
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="submit" className="btn btn-primary">Create Loan</button>
                          <button type="button" className="btn btn-secondary" onClick={() => setShowLoanForm(null)}>Cancel</button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <style>{`
        @media (max-width: 600px) {
          .card > div:first-child {
            flex-direction: column;
          }
          .card > div:first-child > div:last-child {
            margin-left: 0 !important;
            margin-top: 1rem;
          }
        }
      `}</style>
    </>
  )
}

export default Gear
