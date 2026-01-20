import { useState, useEffect } from 'react'
import { knowledgeLibrary } from '../services/api'
import Navigation from '../components/Navigation'
import LearningOverlay from '../components/LearningOverlay'

function KnowledgeLibrary() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [learningId, setLearningId] = useState(null)
  const [learningInfo, setLearningInfo] = useState(null)
  const [showLearnForm, setShowLearnForm] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  
  const [formData, setFormData] = useState({
    hardware_type: 'mic',
    brand: '',
    model: '',
    user_notes: '',
  })

  useEffect(() => {
    loadItems()
  }, [filterType])

  const loadItems = async () => {
    try {
      const response = await knowledgeLibrary.getAll(filterType || null)
      setItems(response.data)
    } catch (error) {
      console.error('Failed to load knowledge library:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLearnNew = async (e) => {
    e.preventDefault()
    setLearningId('new')
    setLearningInfo({
      type: formData.hardware_type,
      brand: formData.brand,
      model: formData.model
    })
    
    try {
      await knowledgeLibrary.learn(formData)
      setShowLearnForm(false)
      setFormData({ hardware_type: 'mic', brand: '', model: '', user_notes: '' })
      loadItems()
    } catch (error) {
      alert('Failed to learn hardware: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLearningId(null)
      setLearningInfo(null)
    }
  }

  const handleRelearn = async (item) => {
    setLearningId(item.id)
    setLearningInfo({
      type: item.hardware_type,
      brand: item.brand,
      model: item.model
    })
    
    try {
      await knowledgeLibrary.relearn(item.id)
      loadItems()
    } catch (error) {
      alert('Failed to re-learn hardware: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLearningId(null)
      setLearningInfo(null)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this learned hardware? This cannot be undone.')) return
    
    try {
      await knowledgeLibrary.delete(id)
      loadItems()
    } catch (error) {
      alert('Failed to delete: ' + (error.response?.data?.detail || error.message))
    }
  }

  const typeLabels = {
    mic: 'Microphone',
    microphone: 'Microphone',
    speaker: 'Speaker',
    amplifier: 'Amplifier',
    di_box: 'DI Box',
    mixer: 'Mixer',
  }

  const typeEmojis = {
    mic: '🎤',
    microphone: '🎤',
    speaker: '🔊',
    amplifier: '🔌',
    di_box: '📦',
    mixer: '🎛️',
  }

  const groupedItems = items.reduce((acc, item) => {
    const type = item.hardware_type
    if (!acc[type]) acc[type] = []
    acc[type].push(item)
    return acc
  }, {})

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <Navigation />
      <LearningOverlay 
        isVisible={learningId !== null}
        hardwareType={learningInfo?.type}
        brand={learningInfo?.brand}
        model={learningInfo?.model}
      />
      
      <div className="container">
        <div className="page-header">
          <div>
            <h1>📚 Knowledge Library</h1>
            <p className="page-subtitle">
              Hardware Claude has learned about • Use for venue-installed equipment you don't own
            </p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => setShowLearnForm(!showLearnForm)}
          >
            {showLearnForm ? 'Cancel' : '+ Learn New Hardware'}
          </button>
        </div>

        {/* Learn New Hardware Form */}
        {showLearnForm && (
          <div className="card learn-form-card">
            <h2 className="card-header">🧠 Teach Claude About New Hardware</h2>
            <p className="form-description">
              Claude will research this hardware and learn its characteristics, best uses, and recommended settings.
            </p>
            
            <form onSubmit={handleLearnNew}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Hardware Type *</label>
                  <select
                    className="form-select"
                    value={formData.hardware_type}
                    onChange={(e) => setFormData({ ...formData, hardware_type: e.target.value })}
                    required
                  >
                    <option value="mic">🎤 Microphone</option>
                    <option value="speaker">🔊 Speaker</option>
                    <option value="amplifier">🔌 Amplifier</option>
                    <option value="di_box">📦 DI Box</option>
                    <option value="mixer">🎛️ Mixer</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Brand *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g., Crown, Martin Audio, Shure"
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
                    placeholder="e.g., XTI-4002, CDD-10, SM58"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.user_notes}
                    onChange={(e) => setFormData({ ...formData, user_notes: e.target.value })}
                    placeholder="Any specific context or use cases"
                  />
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary" disabled={learningId === 'new'}>
                🧠 Learn with Claude
              </button>
            </form>
          </div>
        )}

        {/* Filter */}
        <div className="filter-bar">
          <label>Filter by type:</label>
          <select 
            className="form-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ width: 'auto', minWidth: '150px' }}
          >
            <option value="">All Types</option>
            <option value="mic">🎤 Microphones</option>
            <option value="speaker">🔊 Speakers</option>
            <option value="amplifier">🔌 Amplifiers</option>
            <option value="di_box">📦 DI Boxes</option>
            <option value="mixer">🎛️ Mixers</option>
          </select>
          <span className="item-count">{items.length} device{items.length !== 1 ? 's' : ''} learned</span>
        </div>

        {/* Items List */}
        {items.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📚</span>
            <h3>No Learned Hardware Yet</h3>
            <p>Click "Learn New Hardware" to teach Claude about equipment.</p>
            <p className="empty-hint">
              Great for venue-installed gear like amps, speakers, and mixers you don't own but need to configure.
            </p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([type, typeItems]) => (
            <div key={type} className="type-section">
              <h2 className="type-header">
                {typeEmojis[type] || '📦'} {typeLabels[type] || type}s
                <span className="type-count">({typeItems.length})</span>
              </h2>
              
              {typeItems.map((item) => (
                <div key={item.id} className={`knowledge-card ${expandedId === item.id ? 'expanded' : ''}`}>
                  <div className="knowledge-card-header" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    <div className="knowledge-card-title">
                      <span className="type-emoji">{typeEmojis[item.hardware_type] || '📦'}</span>
                      <div>
                        <h3>{item.brand} {item.model}</h3>
                        <p className="knowledge-card-subtitle">
                          {item.best_for ? item.best_for.substring(0, 80) + (item.best_for.length > 80 ? '...' : '') : 'Click to expand'}
                        </p>
                      </div>
                    </div>
                    <div className="knowledge-card-actions">
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => { e.stopPropagation(); handleRelearn(item); }}
                        disabled={learningId === item.id}
                        title="Re-learn to update settings"
                      >
                        {learningId === item.id ? '...' : '🔄'}
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                      <span className="expand-icon">{expandedId === item.id ? '▼' : '▶'}</span>
                    </div>
                  </div>
                  
                  {expandedId === item.id && (
                    <div className="knowledge-card-content">
                      {item.characteristics && (
                        <div className="knowledge-section">
                          <h4>🎯 Characteristics</h4>
                          <p>{item.characteristics}</p>
                        </div>
                      )}
                      
                      {item.best_for && (
                        <div className="knowledge-section">
                          <h4>👍 Best For</h4>
                          <p>{item.best_for}</p>
                        </div>
                      )}
                      
                      {/* Amplifier specs */}
                      {item.hardware_type === 'amplifier' && (item.watts_per_channel || item.amp_specs) && (
                        <div className="knowledge-section amp-specs">
                          <h4>⚡ Amplifier Specifications</h4>
                          <div className="specs-grid">
                            {(item.watts_per_channel || item.amp_specs?.watts_per_channel) && (
                              <p><strong>Power:</strong> {item.watts_per_channel || item.amp_specs?.watts_per_channel}</p>
                            )}
                            {(item.channels || item.amp_specs?.channels) && (
                              <p><strong>Channels:</strong> {item.channels || item.amp_specs?.channels}</p>
                            )}
                            {(item.amplifier_class || item.amp_specs?.amplifier_class) && (
                              <p><strong>Class:</strong> {item.amplifier_class || item.amp_specs?.amplifier_class}</p>
                            )}
                            {(item.frequency_response || item.amp_specs?.frequency_response) && (
                              <p><strong>Frequency:</strong> {item.frequency_response || item.amp_specs?.frequency_response}</p>
                            )}
                            {(item.response_character || item.amp_specs?.response_character) && (
                              <p><strong>Character:</strong> {item.response_character || item.amp_specs?.response_character}</p>
                            )}
                            {(item.damping_factor || item.amp_specs?.damping_factor) && (
                              <p><strong>Damping:</strong> {item.damping_factor || item.amp_specs?.damping_factor}</p>
                            )}
                          </div>
                          {(item.features || item.amp_specs?.features) && (
                            <p><strong>Features:</strong> {(item.features || item.amp_specs?.features).join(', ')}</p>
                          )}
                          {(item.eq_compensation || item.amp_specs?.eq_compensation) && (
                            <p className="eq-tip">💡 <strong>EQ Tip:</strong> {item.eq_compensation || item.amp_specs?.eq_compensation}</p>
                          )}
                        </div>
                      )}
                      
                      {/* Settings by source */}
                      {item.settings_by_source && Object.keys(item.settings_by_source).length > 0 && (
                        <div className="knowledge-section">
                          <h4>⚙️ Settings ({Object.keys(item.settings_by_source).length} presets)</h4>
                          <details>
                            <summary>View detailed settings</summary>
                            <pre className="settings-json">
                              {JSON.stringify(item.settings_by_source, null, 2)}
                            </pre>
                          </details>
                        </div>
                      )}
                      
                      <div className="knowledge-meta">
                        <span>Added: {new Date(item.created_at).toLocaleDateString()}</span>
                        {item.updated_at !== item.created_at && (
                          <span>Updated: {new Date(item.updated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .page-subtitle {
          color: var(--text-secondary);
          font-size: 0.95rem;
          margin-top: 0.25rem;
        }
        
        .learn-form-card {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 2px solid #10b981;
          margin-bottom: 2rem;
        }
        
        .form-description {
          color: #065f46;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
        }
        
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .filter-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-radius: 0.5rem;
          flex-wrap: wrap;
        }
        
        .filter-bar label {
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .item-count {
          margin-left: auto;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }
        
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: var(--bg-secondary);
          border-radius: 1rem;
        }
        
        .empty-icon {
          font-size: 4rem;
          display: block;
          margin-bottom: 1rem;
        }
        
        .empty-state h3 {
          margin-bottom: 0.5rem;
          color: var(--text);
        }
        
        .empty-state p {
          color: var(--text-secondary);
        }
        
        .empty-hint {
          font-size: 0.85rem;
          margin-top: 1rem;
        }
        
        .type-section {
          margin-bottom: 2rem;
        }
        
        .type-header {
          font-size: 1.25rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .type-count {
          font-size: 0.9rem;
          color: var(--text-secondary);
          font-weight: normal;
        }
        
        .knowledge-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          margin-bottom: 0.75rem;
          overflow: hidden;
          transition: all 0.2s ease;
        }
        
        .knowledge-card:hover {
          border-color: var(--primary);
        }
        
        .knowledge-card.expanded {
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        
        .knowledge-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          cursor: pointer;
          gap: 1rem;
        }
        
        .knowledge-card-header:hover {
          background: var(--bg-secondary);
        }
        
        .knowledge-card-title {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex: 1;
          min-width: 0;
        }
        
        .type-emoji {
          font-size: 1.5rem;
          flex-shrink: 0;
        }
        
        .knowledge-card-title h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        
        .knowledge-card-subtitle {
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .knowledge-card-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        
        .btn-sm {
          padding: 0.35rem 0.6rem;
          font-size: 0.85rem;
        }
        
        .expand-icon {
          color: var(--text-secondary);
          font-size: 0.8rem;
          margin-left: 0.5rem;
        }
        
        .knowledge-card-content {
          padding: 0 1.25rem 1.25rem;
          border-top: 1px solid var(--border);
          background: var(--bg-secondary);
        }
        
        .knowledge-section {
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
        }
        
        .knowledge-section:last-of-type {
          border-bottom: none;
        }
        
        .knowledge-section h4 {
          margin: 0 0 0.5rem;
          font-size: 0.95rem;
          color: var(--text);
        }
        
        .knowledge-section p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.6;
        }
        
        .amp-specs {
          background: #eff6ff;
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 1rem 0;
          border: 1px solid #3b82f6;
        }
        
        .amp-specs h4 {
          color: #1d4ed8;
        }
        
        .specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.5rem;
        }
        
        .specs-grid p {
          margin: 0;
          font-size: 0.85rem;
        }
        
        .eq-tip {
          margin-top: 0.75rem !important;
          font-style: italic;
        }
        
        .settings-json {
          background: #1f2937;
          color: #e5e7eb;
          padding: 1rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          overflow-x: auto;
          max-height: 300px;
          margin-top: 0.5rem;
        }
        
        .knowledge-meta {
          display: flex;
          gap: 1.5rem;
          padding-top: 1rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        
        details summary {
          cursor: pointer;
          color: var(--primary);
          font-weight: 500;
          font-size: 0.9rem;
        }
        
        details summary:hover {
          text-decoration: underline;
        }
        
        @media (max-width: 600px) {
          .page-header {
            flex-direction: column;
          }
          
          .filter-bar {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .item-count {
            margin-left: 0;
          }
          
          .knowledge-card-header {
            flex-direction: column;
            align-items: flex-start;
          }
          
          .knowledge-card-actions {
            width: 100%;
            justify-content: flex-end;
            margin-top: 0.5rem;
          }
        }
      `}</style>
    </>
  )
}

export default KnowledgeLibrary
