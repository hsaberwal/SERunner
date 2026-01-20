import { useState, useEffect } from 'react'
import { gear } from '../services/api'
import Navigation from '../components/Navigation'
import LearningOverlay from '../components/LearningOverlay'

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

  // Hardware learning state
  const [learningGearId, setLearningGearId] = useState(null)
  const [learningHardwareInfo, setLearningHardwareInfo] = useState(null) // Track what's being learned
  const [learnedSettings, setLearnedSettings] = useState(null)
  const [savedToInventory, setSavedToInventory] = useState(false)
  const [showLearnNewForm, setShowLearnNewForm] = useState(false)
  const [newHardwareData, setNewHardwareData] = useState({
    hardware_type: 'mic',
    brand: '',
    model: '',
    user_notes: '',
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

  // Learn settings for existing gear
  const handleLearnFromGear = async (gearItem, userNotes = null) => {
    setLearningGearId(gearItem.id)
    setLearningHardwareInfo({
      type: gearItem.type,
      brand: gearItem.brand,
      model: gearItem.model
    })
    setLearnedSettings(null)
    setSavedToInventory(false)
    try {
      const response = await gear.learnFromExisting(gearItem.id, userNotes)
      setLearnedSettings({ ...response.data, existingGearId: gearItem.id })
      setSavedToInventory(true) // Already saved for existing gear
      // Reload gear to get updated default_settings
      loadGear()
    } catch (error) {
      alert('Failed to learn settings: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLearningGearId(null)
      setLearningHardwareInfo(null)
    }
  }

  // Learn settings for new (not-yet-added) hardware
  const handleLearnNewHardware = async (e) => {
    e.preventDefault()
    setLearningGearId('new')
    setLearningHardwareInfo({
      type: newHardwareData.hardware_type,
      brand: newHardwareData.brand,
      model: newHardwareData.model
    })
    setLearnedSettings(null)
    setSavedToInventory(false)
    try {
      const response = await gear.learn(newHardwareData)
      setLearnedSettings(response.data)
    } catch (error) {
      alert('Failed to learn settings: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLearningGearId(null)
      setLearningHardwareInfo(null)
    }
  }

  // Save learned hardware to inventory
  const handleSaveToInventory = async () => {
    if (!learnedSettings) return
    
    try {
      const newGear = {
        type: learnedSettings.hardware_type || newHardwareData.hardware_type,
        brand: learnedSettings.brand,
        model: learnedSettings.model,
        quantity: 1,
        notes: learnedSettings.characteristics || '',
        default_settings: learnedSettings.settings_by_source || {}
      }
      
      // Add amplifier-specific fields
      if (newGear.type === 'amplifier') {
        newGear.default_settings = {
          ...newGear.default_settings,
          watts_per_channel: learnedSettings.watts_per_channel,
          channels: learnedSettings.channels,
          amplifier_class: learnedSettings.amplifier_class,
          frequency_response: learnedSettings.frequency_response,
          response_character: learnedSettings.response_character,
          damping_factor: learnedSettings.damping_factor,
          features: learnedSettings.features,
          eq_compensation: learnedSettings.eq_compensation
        }
      }
      
      await gear.create(newGear)
      setSavedToInventory(true)
      loadGear()
    } catch (error) {
      alert('Failed to save to inventory: ' + (error.response?.data?.detail || error.message))
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
    amplifier: 'Amplifiers',
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
      <LearningOverlay 
        isVisible={learningGearId !== null} 
        hardwareType={learningHardwareInfo?.type}
        brand={learningHardwareInfo?.brand}
        model={learningHardwareInfo?.model}
      />
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1>Gear Inventory</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => { setShowLearnNewForm(!showLearnNewForm); setShowForm(false); setLearnedSettings(null); }}>
              {showLearnNewForm ? 'Cancel' : 'Learn New Hardware'}
            </button>
            <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setShowLearnNewForm(false); }}>
              {showForm ? 'Cancel' : 'Add Gear'}
            </button>
          </div>
        </div>

        {/* Learn New Hardware Form */}
        {showLearnNewForm && (
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 className="card-header">Learn New Hardware Settings</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Use Claude to generate recommended EQ/compression settings for hardware you're considering or just acquired.
            </p>
            <form onSubmit={handleLearnNewHardware}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Hardware Type *</label>
                  <select
                    className="form-select"
                    value={newHardwareData.hardware_type}
                    onChange={(e) => setNewHardwareData({ ...newHardwareData, hardware_type: e.target.value })}
                    required
                  >
                    <option value="mic">Microphone</option>
                    <option value="speaker">Speaker</option>
                    <option value="amplifier">Amplifier</option>
                    <option value="di_box">DI Box</option>
                    <option value="mixer">Mixer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Brand *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newHardwareData.brand}
                    onChange={(e) => setNewHardwareData({ ...newHardwareData, brand: e.target.value })}
                    placeholder="e.g., Shure, Sennheiser"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Model *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newHardwareData.model}
                    onChange={(e) => setNewHardwareData({ ...newHardwareData, model: e.target.value })}
                    placeholder="e.g., SM58, e835"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newHardwareData.user_notes}
                    onChange={(e) => setNewHardwareData({ ...newHardwareData, user_notes: e.target.value })}
                    placeholder="Any specific use cases or concerns"
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={learningGearId === 'new'}>
                {learningGearId === 'new' ? 'Learning...' : 'Generate Settings with Claude'}
              </button>
            </form>

            {/* Display learned settings - Enhanced UI */}
            {learnedSettings && !learnedSettings.error && (
              <div className="learned-results">
                <div className="learned-results-header">
                  <span style={{ fontSize: '1.5rem' }}>✅</span>
                  <h3>Claude Learned: {learnedSettings.brand} {learnedSettings.model}</h3>
                  <span className="learned-results-badge">
                    {savedToInventory ? 'Saved to Inventory' : 'Ready to Save'}
                  </span>
                </div>

                {/* Characteristics */}
                {learnedSettings.characteristics && (
                  <div className="learned-section">
                    <h4>🎯 Sonic Characteristics</h4>
                    <p>{learnedSettings.characteristics}</p>
                  </div>
                )}

                {/* Best For */}
                {learnedSettings.best_for && (
                  <div className="learned-section">
                    <h4>👍 Best Used For</h4>
                    <p>{learnedSettings.best_for}</p>
                  </div>
                )}

                {/* Amplifier-specific info */}
                {learnedSettings.hardware_type === 'amplifier' && (
                  <div className="learned-section">
                    <h4>⚡ Amplifier Specifications</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {learnedSettings.watts_per_channel && (
                        <p><strong>Power:</strong> {learnedSettings.watts_per_channel}</p>
                      )}
                      {learnedSettings.channels && (
                        <p><strong>Channels:</strong> {learnedSettings.channels}</p>
                      )}
                      {learnedSettings.amplifier_class && (
                        <p><strong>Class:</strong> {learnedSettings.amplifier_class}</p>
                      )}
                      {learnedSettings.frequency_response && (
                        <p><strong>Frequency:</strong> {learnedSettings.frequency_response}</p>
                      )}
                      {learnedSettings.response_character && (
                        <p><strong>Character:</strong> {learnedSettings.response_character}</p>
                      )}
                      {learnedSettings.damping_factor && (
                        <p><strong>Damping:</strong> {learnedSettings.damping_factor}</p>
                      )}
                    </div>
                    {learnedSettings.features && learnedSettings.features.length > 0 && (
                      <p style={{ marginTop: '0.5rem' }}><strong>Features:</strong> {learnedSettings.features.join(', ')}</p>
                    )}
                    {learnedSettings.eq_compensation && (
                      <p style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>💡 <strong>EQ Tip:</strong> {learnedSettings.eq_compensation}</p>
                    )}
                  </div>
                )}

                {/* Settings by Source */}
                {learnedSettings.settings_by_source && Object.keys(learnedSettings.settings_by_source).length > 0 && (
                  <div className="learned-section">
                    <h4>⚙️ Settings by Source ({Object.keys(learnedSettings.settings_by_source).length} presets)</h4>
                    <details style={{ marginTop: '0.5rem' }}>
                      <summary style={{ cursor: 'pointer', color: '#065f46', fontWeight: '500' }}>
                        Click to view detailed settings
                      </summary>
                      <div className="settings-preview" style={{ marginTop: '0.5rem' }}>
                        <pre style={{ margin: 0 }}>{JSON.stringify(learnedSettings.settings_by_source, null, 2)}</pre>
                      </div>
                    </details>
                  </div>
                )}

                {/* What's being saved */}
                <div className="learned-section" style={{ background: '#eff6ff', border: '1px solid #3b82f6' }}>
                  <h4>💾 What's Saved to Database</h4>
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#1e40af' }}>
                    <li>Hardware type, brand, and model</li>
                    <li>Sonic characteristics and best-use recommendations</li>
                    {learnedSettings.settings_by_source && (
                      <li>{Object.keys(learnedSettings.settings_by_source).length} source-specific EQ/compression presets</li>
                    )}
                    {learnedSettings.hardware_type === 'amplifier' && (
                      <li>Power output, frequency response, and amplifier class</li>
                    )}
                  </ul>
                </div>

                {/* Knowledge Base Entry (collapsible) */}
                {learnedSettings.knowledge_base_entry && (
                  <div className="learned-section">
                    <h4>📝 Knowledge Base Entry</h4>
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#065f46', fontWeight: '500', fontSize: '0.85rem' }}>
                        View markdown for sound-knowledge-base.md
                      </summary>
                      <textarea
                        readOnly
                        value={learnedSettings.knowledge_base_entry}
                        style={{ width: '100%', minHeight: '120px', fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.5rem', marginTop: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.25rem' }}
                        onClick={(e) => e.target.select()}
                      />
                    </details>
                  </div>
                )}

                {/* Actions */}
                <div className="learned-actions">
                  {!savedToInventory ? (
                    <button className="btn btn-primary" onClick={handleSaveToInventory}>
                      💾 Save to Inventory
                    </button>
                  ) : (
                    <div className="saved-indicator">
                      <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Saved to Inventory
                    </div>
                  )}
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => { setLearnedSettings(null); setSavedToInventory(false); }}
                  >
                    Clear Results
                  </button>
                </div>
              </div>
            )}

            {learnedSettings?.error && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef2f2', border: '1px solid #ef4444', borderRadius: '0.5rem' }}>
                <strong style={{ color: '#dc2626' }}>Error:</strong> {learnedSettings.error}
                {learnedSettings.raw_response && (
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.8rem' }}>View raw response</summary>
                    <pre style={{ fontSize: '0.7rem', overflow: 'auto', maxHeight: '200px' }}>{learnedSettings.raw_response}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

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
                    <option value="amplifier">Amplifier</option>
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

                      {/* Amplifier-specific specs */}
                      {item.type === 'amplifier' && item.default_settings && (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: '0.375rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#1d4ed8' }}>Amplifier Specs</strong>
                          <div style={{ fontSize: '0.75rem', color: '#1e40af', margin: '0.25rem 0 0' }}>
                            {item.default_settings.watts_per_channel && (
                              <p style={{ margin: '0.15rem 0' }}>⚡ Output: {item.default_settings.watts_per_channel}</p>
                            )}
                            {item.default_settings.channels && (
                              <p style={{ margin: '0.15rem 0' }}>📊 Channels: {item.default_settings.channels}</p>
                            )}
                            {item.default_settings.amplifier_class && (
                              <p style={{ margin: '0.15rem 0' }}>🔧 Class: {item.default_settings.amplifier_class}</p>
                            )}
                            {item.default_settings.frequency_response && (
                              <p style={{ margin: '0.15rem 0' }}>📈 Frequency: {item.default_settings.frequency_response}</p>
                            )}
                            {item.default_settings.response_character && (
                              <p style={{ margin: '0.15rem 0' }}>🎚️ Character: {item.default_settings.response_character}</p>
                            )}
                            {item.default_settings.damping_factor && (
                              <p style={{ margin: '0.15rem 0' }}>🎛️ Damping: {item.default_settings.damping_factor}</p>
                            )}
                            {item.default_settings.features && item.default_settings.features.length > 0 && (
                              <p style={{ margin: '0.15rem 0' }}>✨ Features: {item.default_settings.features.join(', ')}</p>
                            )}
                            {item.default_settings.eq_compensation && (
                              <p style={{ margin: '0.15rem 0', fontStyle: 'italic' }}>💡 EQ Tip: {item.default_settings.eq_compensation}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Default Settings (if learned) - for non-amp gear */}
                      {item.type !== 'amplifier' && item.default_settings && Object.keys(item.default_settings).length > 0 && (
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '0.375rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#059669' }}>Learned Settings Available</strong>
                          <p style={{ fontSize: '0.75rem', color: '#047857', margin: '0.25rem 0 0' }}>
                            Settings for {Object.keys(item.default_settings).length} source type(s)
                          </p>
                        </div>
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

                    <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem', flexWrap: 'wrap' }}>
                      {/* Learn settings for microphones, speakers, amps, and DI boxes */}
                      {['mic', 'speaker', 'di_box', 'amplifier'].includes(item.type) && (
                        <button
                          className="btn btn-info"
                          onClick={() => handleLearnFromGear(item)}
                          disabled={learningGearId === item.id}
                          style={{ padding: '0.5rem 1rem' }}
                          title="Use Claude to generate/update recommended settings"
                        >
                          {learningGearId === item.id ? 'Learning...' : 'Learn'}
                        </button>
                      )}
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
        .btn-info {
          background: #3b82f6;
          color: white;
          border: none;
        }
        .btn-info:hover {
          background: #2563eb;
        }
        .btn-info:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }
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
