import { useState, useEffect } from 'react'

function WhatsNew({ isOpen, onClose }) {
  const [versionInfo, setVersionInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen) {
      loadVersionInfo()
    }
  }, [isOpen])

  const loadVersionInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      // Add cache-busting query param to ensure we get fresh version info
      const cacheBuster = Date.now()
      const response = await fetch(`/version.json?_=${cacheBuster}`, {
        cache: 'no-store' // Tell browser not to use cache
      })
      if (!response.ok) throw new Error('Version info not available')
      const data = await response.json()
      setVersionInfo(data)
    } catch (err) {
      setError('Could not load version info')
      console.error('Failed to load version info:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const getCommitIcon = (message) => {
    const msg = message.toLowerCase()
    if (msg.includes('fix')) return '🐛'
    if (msg.includes('feature') || msg.includes('add')) return '✨'
    if (msg.includes('update') || msg.includes('improve')) return '🔧'
    if (msg.includes('refactor')) return '♻️'
    if (msg.includes('docs') || msg.includes('readme')) return '📝'
    if (msg.includes('style') || msg.includes('ui')) return '🎨'
    if (msg.includes('test')) return '🧪'
    if (msg.includes('deploy') || msg.includes('build')) return '🚀'
    if (msg.includes('security')) return '🔒'
    if (msg.includes('remove') || msg.includes('delete')) return '🗑️'
    return '📦'
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content whats-new-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="modal-header">
          <h2>🚀 What's New in SERunner</h2>
          {versionInfo && (
            <div className="version-badge">
              v{versionInfo.version} • {versionInfo.commitHash}
            </div>
          )}
        </div>

        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading version info...</p>
          </div>
        )}

        {error && (
          <div className="error-state">
            <p>⚠️ {error}</p>
          </div>
        )}

        {versionInfo && !loading && (
          <div className="version-content">
            <div className="build-info">
              <div className="build-item">
                <span className="build-label">Branch:</span>
                <span className="build-value">{versionInfo.branch}</span>
              </div>
              <div className="build-item">
                <span className="build-label">Built:</span>
                <span className="build-value">{formatDate(versionInfo.buildTime)}</span>
              </div>
            </div>

            <h3>Recent Changes</h3>
            
            {versionInfo.commits && versionInfo.commits.length > 0 ? (
              <ul className="commit-list">
                {versionInfo.commits.map((commit, index) => (
                  <li key={commit.hash + index} className="commit-item">
                    <span className="commit-icon">{getCommitIcon(commit.message)}</span>
                    <div className="commit-details">
                      <span className="commit-message">{commit.message}</span>
                      <div className="commit-meta">
                        <code className="commit-hash">{commit.hash}</code>
                        <span className="commit-date">{formatDate(commit.date)}</span>
                        {commit.author && <span className="commit-author">by {commit.author}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-commits">No recent commits available</p>
            )}

            <div className="modal-footer">
              <p className="footer-note">
                Updates are deployed automatically when changes are pushed to the repository.
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 1rem;
          max-width: 600px;
          width: 100%;
          max-height: 85vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: #f3f4f6;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 1.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          transition: all 0.2s;
        }

        .modal-close:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .modal-header {
          position: relative;
          padding: 1.5rem 1.5rem 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #111827;
        }

        .version-badge {
          display: inline-block;
          margin-top: 0.5rem;
          padding: 0.25rem 0.75rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 1rem;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .version-content {
          padding: 1.5rem;
          overflow-y: auto;
        }

        .build-info {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          padding: 0.75rem 1rem;
          background: #f9fafb;
          border-radius: 0.5rem;
        }

        .build-item {
          display: flex;
          gap: 0.5rem;
        }

        .build-label {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .build-value {
          color: #111827;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .version-content h3 {
          margin: 0 0 1rem;
          font-size: 1.1rem;
          color: #374151;
        }

        .commit-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .commit-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem;
          border-radius: 0.5rem;
          transition: background 0.2s;
        }

        .commit-item:hover {
          background: #f9fafb;
        }

        .commit-item:not(:last-child) {
          border-bottom: 1px solid #f3f4f6;
        }

        .commit-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .commit-details {
          flex: 1;
          min-width: 0;
        }

        .commit-message {
          display: block;
          font-weight: 500;
          color: #111827;
          margin-bottom: 0.25rem;
          word-break: break-word;
        }

        .commit-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .commit-hash {
          background: #f3f4f6;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-family: monospace;
        }

        .commit-author {
          color: #9ca3af;
        }

        .no-commits {
          color: #6b7280;
          text-align: center;
          padding: 2rem;
        }

        .modal-footer {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .footer-note {
          font-size: 0.85rem;
          color: #9ca3af;
          text-align: center;
          margin: 0;
        }

        .loading-state, .error-state {
          padding: 3rem;
          text-align: center;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-state {
          color: #dc2626;
        }

        @media (max-width: 480px) {
          .modal-content {
            margin: 0.5rem;
            max-height: 90vh;
          }

          .build-info {
            flex-direction: column;
            gap: 0.5rem;
          }

          .commit-meta {
            flex-direction: column;
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  )
}

export default WhatsNew
