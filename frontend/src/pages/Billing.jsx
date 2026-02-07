import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Navigation from '../components/Navigation'
import { billing } from '../services/api'

function Billing() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [billingData, setBillingData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccess(true)
      // Remove the query param after showing
      window.history.replaceState({}, '', '/billing')
    }
    loadBillingData()
  }, [])

  const loadBillingData = async () => {
    try {
      const response = await billing.getStatus()
      setBillingData(response.data)
    } catch (err) {
      setError('Failed to load billing information')
    } finally {
      setLoading(false)
    }
  }

  const handleManageBilling = async () => {
    try {
      const response = await billing.createPortal()
      window.location.href = response.data.portal_url
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to open billing portal')
    }
  }

  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="container"><div className="loading">Loading billing info...</div></div>
      </div>
    )
  }

  const plan = billingData?.plan || 'free'
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1)
  const genUsed = billingData?.generations_used || 0
  const genLimit = billingData?.generation_limit
  const learnUsed = billingData?.learning_used || 0
  const learnLimit = billingData?.learning_limit
  const isUnlimited = genLimit === 'unlimited'

  const genPercent = isUnlimited ? 0 : (genLimit > 0 ? Math.min(100, (genUsed / genLimit) * 100) : 0)
  const learnPercent = learnLimit === 'unlimited' ? 0 : (learnLimit > 0 ? Math.min(100, (learnUsed / learnLimit) * 100) : 0)

  return (
    <div>
      <Navigation />
      <div className="container">
        <h1>Billing & Usage</h1>

        {showSuccess && (
          <div className="success-message billing-success">
            <strong>Payment successful!</strong> Your plan has been upgraded. It may take a moment for changes to reflect.
            <button onClick={() => { setShowSuccess(false); loadBillingData() }} className="btn btn-small btn-secondary" style={{ marginLeft: '1rem' }}>
              Refresh
            </button>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="billing-grid">
          {/* Current Plan Card */}
          <div className="billing-card">
            <div className="billing-card-header">
              <h2>Current Plan</h2>
              <span className={`plan-badge plan-badge-${plan}`}>{planName}</span>
            </div>
            <div className="billing-card-body">
              {billingData?.period_end && plan !== 'free' && (
                <p className="billing-period">
                  {billingData.canceled_at ? 'Access until' : 'Renews'}: {new Date(billingData.period_end).toLocaleDateString()}
                </p>
              )}
              {billingData?.canceled_at && (
                <p className="billing-canceled">
                  Cancellation scheduled. Access continues until period end.
                </p>
              )}
              <div className="billing-actions">
                {plan === 'free' ? (
                  <Link to="/pricing" className="btn btn-primary">Upgrade Plan</Link>
                ) : (
                  <>
                    <button onClick={handleManageBilling} className="btn btn-secondary">
                      Manage Subscription
                    </button>
                    <Link to="/pricing" className="btn btn-primary" style={{ marginLeft: '0.5rem' }}>
                      Change Plan
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Usage Card */}
          <div className="billing-card">
            <div className="billing-card-header">
              <h2>Usage This Period</h2>
            </div>
            <div className="billing-card-body">
              {/* Generations */}
              <div className="usage-item">
                <div className="usage-label">
                  <span>AI Setup Generations</span>
                  <span className="usage-count">
                    {genUsed} / {isUnlimited ? '\u221E' : genLimit}
                  </span>
                </div>
                {!isUnlimited && (
                  <div className="usage-bar">
                    <div 
                      className={`usage-bar-fill ${genPercent >= 90 ? 'usage-bar-danger' : genPercent >= 70 ? 'usage-bar-warning' : ''}`}
                      style={{ width: `${genPercent}%` }}
                    />
                  </div>
                )}
                {isUnlimited && <div className="usage-unlimited">Unlimited</div>}
              </div>

              {/* Learnings */}
              <div className="usage-item">
                <div className="usage-label">
                  <span>Hardware Learnings</span>
                  <span className="usage-count">
                    {learnUsed} / {learnLimit === 'unlimited' ? '\u221E' : learnLimit}
                  </span>
                </div>
                {learnLimit !== 'unlimited' && (
                  <div className="usage-bar">
                    <div 
                      className={`usage-bar-fill ${learnPercent >= 90 ? 'usage-bar-danger' : learnPercent >= 70 ? 'usage-bar-warning' : ''}`}
                      style={{ width: `${learnPercent}%` }}
                    />
                  </div>
                )}
                {learnLimit === 'unlimited' && <div className="usage-unlimited">Unlimited</div>}
              </div>

              {genPercent >= 80 && !isUnlimited && (
                <div className="usage-warning">
                  Running low on generations! <Link to="/pricing">Upgrade your plan</Link> for more.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plan Comparison */}
        <div className="billing-comparison">
          <h3>Plan Comparison</h3>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th className={plan === 'free' ? 'current-col' : ''}>Free</th>
                <th className={plan === 'basic' ? 'current-col' : ''}>Basic ($8/mo)</th>
                <th className={plan === 'pro' ? 'current-col' : ''}>Pro ($18/mo)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>AI Setup Generations</td>
                <td className={plan === 'free' ? 'current-col' : ''}>2/month</td>
                <td className={plan === 'basic' ? 'current-col' : ''}>15/month</td>
                <td className={plan === 'pro' ? 'current-col' : ''}>Unlimited</td>
              </tr>
              <tr>
                <td>Hardware Learnings</td>
                <td className={plan === 'free' ? 'current-col' : ''}>3/month</td>
                <td className={plan === 'basic' ? 'current-col' : ''}>20/month</td>
                <td className={plan === 'pro' ? 'current-col' : ''}>Unlimited</td>
              </tr>
              <tr>
                <td>Event Wizard</td>
                <td className={plan === 'free' ? 'current-col' : ''}>&#10003;</td>
                <td className={plan === 'basic' ? 'current-col' : ''}>&#10003;</td>
                <td className={plan === 'pro' ? 'current-col' : ''}>&#10003;</td>
              </tr>
              <tr>
                <td>Smart Setup Matching</td>
                <td className={plan === 'free' ? 'current-col' : ''}>&#10003;</td>
                <td className={plan === 'basic' ? 'current-col' : ''}>&#10003;</td>
                <td className={plan === 'pro' ? 'current-col' : ''}>&#10003;</td>
              </tr>
              <tr>
                <td>Knowledge Library</td>
                <td className={plan === 'free' ? 'current-col' : ''}>&#10003;</td>
                <td className={plan === 'basic' ? 'current-col' : ''}>&#10003;</td>
                <td className={plan === 'pro' ? 'current-col' : ''}>&#10003;</td>
              </tr>
              <tr>
                <td>Shared Setups</td>
                <td className={plan === 'free' ? 'current-col' : ''}>&#10007;</td>
                <td className={plan === 'basic' ? 'current-col' : ''}>&#10003;</td>
                <td className={plan === 'pro' ? 'current-col' : ''}>&#10003;</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Billing
