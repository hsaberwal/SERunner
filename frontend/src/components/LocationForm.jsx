import { useState, useEffect } from 'react'

// Default empty speaker setup structure
export const emptySpeakerSetup = {
  lr_mains: { brand: '', model: '', powered: true, quantity: 2, watts: '', notes: '' },
  sub: { brand: '', model: '', powered: true, quantity: 0, watts: '', notes: '' },
  monitors: { brand: '', model: '', powered: true, quantity: 0, watts: '', notes: '' },
  amp: { brand: '', model: '', watts: '', channels: '', notes: '' }
}

// Common GEQ frequencies for ring-out
export const geqFrequencies = ['63Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz']

// Known speakers and amps
export const knownSpeakers = [
  { value: '', label: 'Select or type custom...' },
  { value: 'Martin Audio CDD-10', label: 'Martin Audio CDD-10' },
  { value: 'EV ZLX-12P', label: 'Electro-Voice ZLX-12P' },
  { value: 'EV ZX1-90', label: 'Electro-Voice ZX1-90' },
  { value: 'EV Evolve 50', label: 'Electro-Voice Evolve 50' },
  { value: 'custom', label: 'Other (type below)' }
]

export const knownAmps = [
  { value: '', label: 'Select or type custom...' },
  { value: 'Crown XTi 1002', label: 'Crown XTi 1002' },
  { value: 'Crown XTi 2002', label: 'Crown XTi 2002' },
  { value: 'Crown XTi 4002', label: 'Crown XTi 4002' },
  { value: 'Crown XLS 1002', label: 'Crown XLS 1002' },
  { value: 'Crown XLS 1502', label: 'Crown XLS 1502' },
  { value: 'Crown XLS 2002', label: 'Crown XLS 2002' },
  { value: 'Crown CDi 1000', label: 'Crown CDi 1000 (70V)' },
  { value: 'custom', label: 'Other (type below)' }
]

// Helper to get empty form data
export const getEmptyLocationData = () => ({
  name: '',
  venue_type: '',
  notes: '',
  is_temporary: false,
  speaker_setup: { ...emptySpeakerSetup },
  lr_geq_cuts: {},
  monitor_geq_cuts: {},
  room_notes: ''
})

// Helper to clean speaker setup for API
export const cleanSpeakerSetup = (setup) => {
  if (!setup) return null
  const cleaned = {}
  for (const [key, value] of Object.entries(setup)) {
    if (value && (value.brand || value.model || value.quantity > 0)) {
      cleaned[key] = value
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null
}

// Helper to clean form data for API submission
export const cleanLocationData = (formData) => ({
  ...formData,
  speaker_setup: cleanSpeakerSetup(formData.speaker_setup),
  lr_geq_cuts: Object.keys(formData.lr_geq_cuts || {}).length > 0 ? formData.lr_geq_cuts : null,
  monitor_geq_cuts: Object.keys(formData.monitor_geq_cuts || {}).length > 0 ? formData.monitor_geq_cuts : null,
  room_notes: formData.room_notes || null
})

/**
 * Reusable Location Form Component
 *
 * Props:
 * - formData: object - The location data to edit
 * - onChange: function(newData) - Called when any field changes
 * - onSubmit: function(cleanedData) - Called when form is submitted
 * - onCancel: function - Called when cancel is clicked (optional)
 * - submitLabel: string - Label for submit button (default: "Save Location")
 * - showCancel: boolean - Whether to show cancel button (default: false)
 * - compact: boolean - Use compact styling for embedded forms (default: false)
 * - showGEQ: boolean - Whether to show GEQ cuts section (default: true)
 */
function LocationForm({
  formData,
  onChange,
  onSubmit,
  onCancel,
  submitLabel = 'Save Location',
  showCancel = false,
  compact = false,
  showGEQ = true,
  disabled = false
}) {
  const updateField = (field, value) => {
    onChange({ ...formData, [field]: value })
  }

  const updateSpeakerField = (category, field, value) => {
    onChange({
      ...formData,
      speaker_setup: {
        ...formData.speaker_setup,
        [category]: {
          ...formData.speaker_setup?.[category],
          [field]: value
        }
      }
    })
  }

  const updateGEQ = (type, freq, value) => {
    const key = type === 'lr' ? 'lr_geq_cuts' : 'monitor_geq_cuts'
    const newCuts = { ...(formData[key] || {}) }
    if (value === '' || value === 0) {
      delete newCuts[freq]
    } else {
      newCuts[freq] = parseInt(value)
    }
    onChange({ ...formData, [key]: newCuts })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onSubmit) {
      onSubmit(cleanLocationData(formData))
    }
  }

  const sectionStyle = compact
    ? { background: 'var(--bg-primary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid var(--border-color)' }
    : { background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }

  return (
    <form onSubmit={handleSubmit}>
      {/* Basic Info */}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Location Name *</label>
          <input
            type="text"
            className="form-input"
            value={formData.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., St. Mary's Church"
            required
            disabled={disabled}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Venue Type</label>
          <select
            className="form-select"
            value={formData.venue_type || ''}
            onChange={(e) => updateField('venue_type', e.target.value)}
            disabled={disabled}
          >
            <option value="">Select type...</option>
            <option value="gurdwara">Gurdwara</option>
            <option value="church">Church</option>
            <option value="temple">Temple</option>
            <option value="hall">Hall</option>
            <option value="cafe">Cafe</option>
            <option value="outdoor">Outdoor</option>
            <option value="school">School</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={formData.is_temporary || false}
            onChange={(e) => updateField('is_temporary', e.target.checked)}
            disabled={disabled}
          />
          Temporary location (one-time event)
        </label>
      </div>

      {/* Speaker Setup Section */}
      <div style={sectionStyle}>
        <h4 style={{ fontSize: compact ? '0.9rem' : '1rem', marginBottom: '1rem' }}>Speaker Setup</h4>

        {/* LR Mains */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>LR Mains</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="form-select"
              value={knownSpeakers.find(s => s.value === formData.speaker_setup?.lr_mains?.model)?.value ||
                     (formData.speaker_setup?.lr_mains?.model ? 'custom' : '')}
              onChange={(e) => {
                if (e.target.value && e.target.value !== 'custom') {
                  const parts = e.target.value.split(' ')
                  updateSpeakerField('lr_mains', 'brand', parts[0])
                  updateSpeakerField('lr_mains', 'model', e.target.value)
                } else if (e.target.value === 'custom') {
                  updateSpeakerField('lr_mains', 'brand', '')
                  updateSpeakerField('lr_mains', 'model', '')
                }
              }}
              disabled={disabled}
            >
              {knownSpeakers.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <input
              type="number"
              className="form-input"
              placeholder="Qty"
              min="0"
              value={formData.speaker_setup?.lr_mains?.quantity || ''}
              onChange={(e) => updateSpeakerField('lr_mains', 'quantity', parseInt(e.target.value) || 0)}
              style={{ width: '60px' }}
              disabled={disabled}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={formData.speaker_setup?.lr_mains?.powered ?? true}
                onChange={(e) => updateSpeakerField('lr_mains', 'powered', e.target.checked)}
                disabled={disabled}
              />
              Powered
            </label>
          </div>
          {(!knownSpeakers.find(s => s.value === formData.speaker_setup?.lr_mains?.model) && formData.speaker_setup?.lr_mains?.model) && (
            <input
              type="text"
              className="form-input"
              placeholder="Custom speaker (Brand Model)"
              value={formData.speaker_setup?.lr_mains?.model || ''}
              onChange={(e) => updateSpeakerField('lr_mains', 'model', e.target.value)}
              style={{ marginTop: '0.25rem' }}
              disabled={disabled}
            />
          )}
        </div>

        {/* Subwoofer */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Subwoofer</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Brand Model (e.g., EV ELX118P)"
              value={formData.speaker_setup?.sub?.model || ''}
              onChange={(e) => updateSpeakerField('sub', 'model', e.target.value)}
              disabled={disabled}
            />
            <input
              type="number"
              className="form-input"
              placeholder="Qty"
              min="0"
              value={formData.speaker_setup?.sub?.quantity || ''}
              onChange={(e) => updateSpeakerField('sub', 'quantity', parseInt(e.target.value) || 0)}
              style={{ width: '60px' }}
              disabled={disabled}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={formData.speaker_setup?.sub?.powered ?? true}
                onChange={(e) => updateSpeakerField('sub', 'powered', e.target.checked)}
                disabled={disabled}
              />
              Powered
            </label>
          </div>
        </div>

        {/* Monitors */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Monitors</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="form-select"
              value={knownSpeakers.find(s => s.value === formData.speaker_setup?.monitors?.model)?.value ||
                     (formData.speaker_setup?.monitors?.model ? 'custom' : '')}
              onChange={(e) => {
                if (e.target.value && e.target.value !== 'custom') {
                  const parts = e.target.value.split(' ')
                  updateSpeakerField('monitors', 'brand', parts[0])
                  updateSpeakerField('monitors', 'model', e.target.value)
                } else if (e.target.value === 'custom') {
                  updateSpeakerField('monitors', 'brand', '')
                  updateSpeakerField('monitors', 'model', '')
                }
              }}
              disabled={disabled}
            >
              {knownSpeakers.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <input
              type="number"
              className="form-input"
              placeholder="Qty"
              min="0"
              value={formData.speaker_setup?.monitors?.quantity || ''}
              onChange={(e) => updateSpeakerField('monitors', 'quantity', parseInt(e.target.value) || 0)}
              style={{ width: '60px' }}
              disabled={disabled}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={formData.speaker_setup?.monitors?.powered ?? true}
                onChange={(e) => updateSpeakerField('monitors', 'powered', e.target.checked)}
                disabled={disabled}
              />
              Powered
            </label>
          </div>
          {(!knownSpeakers.find(s => s.value === formData.speaker_setup?.monitors?.model) && formData.speaker_setup?.monitors?.model) && (
            <input
              type="text"
              className="form-input"
              placeholder="Custom speaker (Brand Model)"
              value={formData.speaker_setup?.monitors?.model || ''}
              onChange={(e) => updateSpeakerField('monitors', 'model', e.target.value)}
              style={{ marginTop: '0.25rem' }}
              disabled={disabled}
            />
          )}
        </div>

        {/* Amplifier */}
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>
            Amplifier <span style={{ fontWeight: 'normal' }}>(if passive speakers)</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="form-select"
              value={knownAmps.find(a => a.value === formData.speaker_setup?.amp?.model)?.value ||
                     (formData.speaker_setup?.amp?.model ? 'custom' : '')}
              onChange={(e) => {
                if (e.target.value && e.target.value !== 'custom') {
                  updateSpeakerField('amp', 'brand', 'Crown')
                  updateSpeakerField('amp', 'model', e.target.value)
                } else if (e.target.value === 'custom') {
                  updateSpeakerField('amp', 'brand', '')
                  updateSpeakerField('amp', 'model', '')
                }
              }}
              disabled={disabled}
            >
              {knownAmps.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <input
              type="text"
              className="form-input"
              placeholder="Watts"
              value={formData.speaker_setup?.amp?.watts || ''}
              onChange={(e) => updateSpeakerField('amp', 'watts', e.target.value)}
              style={{ width: '80px' }}
              disabled={disabled}
            />
          </div>
          {(!knownAmps.find(a => a.value === formData.speaker_setup?.amp?.model) && formData.speaker_setup?.amp?.model) && (
            <input
              type="text"
              className="form-input"
              placeholder="Custom amp (Brand Model)"
              value={formData.speaker_setup?.amp?.model || ''}
              onChange={(e) => updateSpeakerField('amp', 'model', e.target.value)}
              style={{ marginTop: '0.25rem' }}
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {/* GEQ Cuts Section */}
      {showGEQ && (
        <div style={sectionStyle}>
          <h4 style={{ fontSize: compact ? '0.9rem' : '1rem', marginBottom: '0.5rem' }}>GEQ Cuts from Ring-Out</h4>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Record problem frequencies found during ring-out (negative dB values).
          </p>

          {/* LR GEQ */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>LR Main GEQ</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {geqFrequencies.map(freq => (
                <div key={`lr-${freq}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{freq}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.lr_geq_cuts?.[freq] || ''}
                    onChange={(e) => updateGEQ('lr', freq, e.target.value)}
                    placeholder="0"
                    min="-12"
                    max="0"
                    style={{ width: '42px', textAlign: 'center', padding: '0.2rem', fontSize: '0.8rem' }}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Monitor GEQ */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', display: 'block' }}>Monitor GEQ</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {geqFrequencies.map(freq => (
                <div key={`mon-${freq}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{freq}</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.monitor_geq_cuts?.[freq] || ''}
                    onChange={(e) => updateGEQ('monitor', freq, e.target.value)}
                    placeholder="0"
                    min="-12"
                    max="0"
                    style={{ width: '42px', textAlign: 'center', padding: '0.2rem', fontSize: '0.8rem' }}
                    disabled={disabled}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Room Notes */}
      <div className="form-group">
        <label className="form-label">Room Acoustics Notes</label>
        <textarea
          className="form-textarea"
          value={formData.room_notes || ''}
          onChange={(e) => updateField('room_notes', e.target.value)}
          placeholder="Dead spots, reflections, problem areas..."
          rows={2}
          disabled={disabled}
        />
      </div>

      {/* General Notes */}
      <div className="form-group">
        <label className="form-label">General Notes</label>
        <textarea
          className="form-textarea"
          value={formData.notes || ''}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Contact info, access instructions, power locations..."
          rows={2}
          disabled={disabled}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          {submitLabel}
        </button>
        {showCancel && onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={disabled}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

export default LocationForm
