import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { billing } from '../services/api'

/**
 * UsageBanner - Shows current plan usage before AI actions
 * Props:
 *   type: "generation" | "learning" - which limit to check
 *   onStatusLoaded: callback with { canProceed, subscription } when status loads
 */
function UsageBanner({ type = 'generation', onStatusLoaded }) {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const response = await billing.getStatus()
      setStatus(response.data)
      
      if (onStatusLoaded) {
        const data = response.data
        const isGen = type === 'generation'
        const used = isGen ? data.generations_used : data.learning_used
        const limit = isGen ? data.generation_limit : data.learning_limit
        const canProceed = limit === 'unlimited' || used < limit
        onStatusLoaded({ canProceed, subscription: data })
      }
    } catch (err) {
      // Don't block the UI on billing errors
      if (onStatusLoaded) {
        onStatusLoaded({ canProceed: true, subscription: null })
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading || !status) return null

  const isGen = type === 'generation'
  const used = isGen ? status.generations_used : status.learning_used
  const limit = isGen ? status.generation_limit : status.learning_limit
  const label = isGen ? 'setup generations' : 'hardware learnings'
  const isUnlimited = limit === 'unlimited'
  const isExhausted = !isUnlimited && used >= limit
  const isLow = !isUnlimited && !isExhausted && used >= limit * 0.7

  if (isUnlimited || status.plan === 'admin') return null

  return (
    <div className={`usage-banner ${isExhausted ? 'usage-banner-danger' : isLow ? 'usage-banner-warning' : 'usage-banner-info'}`}>
      <div className="usage-banner-content">
        <span className="usage-banner-icon">
          {isExhausted ? '\u26A0' : isLow ? '\u26A0' : '\u2139'}
        </span>
        <span>
          {isExhausted ? (
            <>
              <strong>Limit reached.</strong> You've used all {limit} {label} this month.{' '}
              <Link to="/pricing">Upgrade your plan</Link> to continue.
            </>
          ) : (
            <>
              <strong>{status.plan.charAt(0).toUpperCase() + status.plan.slice(1)} plan:</strong>{' '}
              {used} of {limit} {label} used this month.
              {isLow && <>{' '}<Link to="/pricing">Upgrade for more</Link></>}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

export default UsageBanner
