import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Navigation from '../components/Navigation'
import { billing } from '../services/api'

function Pricing() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [currentPlan, setCurrentPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [plansRes, statusRes] = await Promise.all([
        billing.getPlans(),
        billing.getStatus()
      ])
      setPlans(plansRes.data.plans)
      setCurrentPlan(statusRes.data)
    } catch (err) {
      setError('Failed to load pricing information')
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId) => {
    if (planId === 'free') return

    setCheckoutLoading(planId)
    setError('')

    try {
      const response = await billing.createCheckout({
        plan: planId,
        success_url: window.location.origin + '/billing?success=true',
        cancel_url: window.location.origin + '/pricing',
      })
      // Redirect to Stripe Checkout
      window.location.href = response.data.checkout_url
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start checkout')
      setCheckoutLoading(null)
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
        <div className="container"><div className="loading">Loading plans...</div></div>
      </div>
    )
  }

  return (
    <div>
      <Navigation />
      <div className="container">
        <div className="pricing-header">
          <h1>Choose Your Plan</h1>
          <p>AI-powered sound engineering setups for your live events</p>
          {currentPlan && currentPlan.plan !== 'free' && (
            <div className="current-plan-badge">
              Currently on <strong>{currentPlan.plan.charAt(0).toUpperCase() + currentPlan.plan.slice(1)}</strong> plan
              <button onClick={handleManageBilling} className="btn btn-small btn-secondary" style={{ marginLeft: '1rem' }}>
                Manage Billing
              </button>
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="pricing-grid">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.plan === plan.id
            const isUpgrade = plan.id !== 'free' && currentPlan?.plan === 'free'
            const isDowngrade = plan.id === 'free' && currentPlan?.plan !== 'free'

            return (
              <div 
                key={plan.id} 
                className={`pricing-card ${plan.id === 'pro' ? 'pricing-card-featured' : ''} ${isCurrent ? 'pricing-card-current' : ''}`}
              >
                {plan.id === 'pro' && <div className="pricing-badge">Most Popular</div>}
                {isCurrent && <div className="pricing-badge pricing-badge-current">Current Plan</div>}

                <div className="pricing-card-header">
                  <h2>{plan.name}</h2>
                  <div className="pricing-price">
                    <span className="pricing-amount">${plan.price}</span>
                    <span className="pricing-interval">/{plan.interval}</span>
                  </div>
                </div>

                <ul className="pricing-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="pricing-check">&#10003;</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="pricing-card-footer">
                  {isCurrent ? (
                    <button className="btn btn-secondary" disabled>
                      Current Plan
                    </button>
                  ) : plan.id === 'free' ? (
                    isDowngrade ? (
                      <button onClick={handleManageBilling} className="btn btn-secondary">
                        Manage Subscription
                      </button>
                    ) : (
                      <button className="btn btn-secondary" disabled>
                        Free Forever
                      </button>
                    )
                  ) : (
                    <button 
                      onClick={() => handleSubscribe(plan.id)} 
                      className={`btn ${plan.id === 'pro' ? 'btn-primary' : 'btn-primary'}`}
                      disabled={checkoutLoading === plan.id}
                    >
                      {checkoutLoading === plan.id ? 'Redirecting...' : isUpgrade ? `Upgrade to ${plan.name}` : `Get ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="pricing-faq">
          <h3>Frequently Asked Questions</h3>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>What counts as a "generation"?</h4>
              <p>Each time the AI creates a new setup or refreshes an existing one counts as one generation. Viewing, editing, or sharing setups does not count.</p>
            </div>
            <div className="faq-item">
              <h4>What counts as a "hardware learning"?</h4>
              <p>Each time the AI researches a new piece of equipment (mic, speaker, amp, etc.) to learn its characteristics and recommended settings.</p>
            </div>
            <div className="faq-item">
              <h4>Can I cancel anytime?</h4>
              <p>Yes! Cancel anytime from the billing portal. You'll keep your plan until the end of the current billing period.</p>
            </div>
            <div className="faq-item">
              <h4>Do my setups disappear if I downgrade?</h4>
              <p>No. All your saved setups, locations, gear, and learned hardware are kept forever regardless of your plan.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Pricing
