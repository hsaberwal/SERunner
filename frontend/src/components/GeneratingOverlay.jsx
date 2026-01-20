import { useState, useEffect } from 'react'
import { stats } from '../services/api'

// Default step durations (will be scaled based on actual API timing)
const DEFAULT_TOTAL_TIME = 60000 // 60 seconds default

const GENERATION_STEPS = [
  { id: 1, label: 'Preparing Request', description: 'Gathering venue and performer data', icon: '📋', pct: 0.05 },
  { id: 2, label: 'Analyzing Setup', description: 'Reviewing past setups and venue characteristics', icon: '🔍', pct: 0.10 },
  { id: 3, label: 'Generating Config', description: 'Building channel settings, EQ, and compression', icon: '⚙️', pct: 0.60 },
  { id: 4, label: 'Finalizing', description: 'Formatting instructions and recommendations', icon: '✨', pct: 0.25 }
]

const SOUND_TIPS = [
  "💡 Tip: Always start with gain staging before EQ adjustments",
  "💡 Tip: Use HPF on vocals to cut rumble below 80-100Hz",
  "💡 Tip: Less is more with compression - start with gentle ratios",
  "💡 Tip: Ring out monitors at lower volume than performance level",
  "💡 Tip: Save your GEQ settings - every room has its own character",
  "💡 Tip: Vocal presence lives around 3-5kHz",
  "💡 Tip: Mud often hides in the 200-400Hz range",
  "💡 Tip: Always soundcheck at performance volume levels",
  "💡 Tip: Trust your ears over the meters",
  "💡 Tip: Leave headroom on the master - aim for -6dB peaks"
]

function GeneratingOverlay({ isVisible }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState({ avg: 60, min: 30, max: 120 })

  // Fetch actual timing data on mount
  useEffect(() => {
    const fetchTiming = async () => {
      try {
        const response = await stats.getResponseTimes()
        if (response.data?.setup_generation) {
          const data = response.data.setup_generation
          setEstimatedTime({
            avg: Math.round(data.avg_seconds),
            min: Math.round(data.min_seconds),
            max: Math.round(data.max_seconds),
            samples: data.sample_count
          })
        }
      } catch (error) {
        console.error('Could not fetch timing data:', error)
      }
    }
    fetchTiming()
  }, [])

  // Progress through steps based on estimated timing
  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(1)
      setElapsedTime(0)
      return
    }

    const totalMs = estimatedTime.avg * 1000
    const stepTimers = []
    let accumulated = 0

    GENERATION_STEPS.forEach((step, index) => {
      if (index > 0) {
        accumulated += GENERATION_STEPS[index - 1].pct * totalMs
        const timer = setTimeout(() => {
          setCurrentStep(step.id)
        }, accumulated)
        stepTimers.push(timer)
      }
    })

    return () => stepTimers.forEach(t => clearTimeout(t))
  }, [isVisible, estimatedTime])

  // Rotate tips every 5 seconds
  useEffect(() => {
    if (!isVisible) return

    const tipTimer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % SOUND_TIPS.length)
    }, 5000)

    return () => clearInterval(tipTimer)
  }, [isVisible])

  // Track elapsed time
  useEffect(() => {
    if (!isVisible) return

    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isVisible])

  if (!isVisible) return null

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <div className="generating-overlay">
      <div className="generating-content">
        {/* Header */}
        <div className="generating-header">
          <div className="generating-icon-pulse">🎛️</div>
          <h2>Generating Your Setup</h2>
          <p className="generating-subtitle">Claude is crafting your QuPac configuration</p>
        </div>

        {/* Progress Steps */}
        <div className="generating-steps">
          {GENERATION_STEPS.map((step) => {
            const isComplete = currentStep > step.id
            const isActive = currentStep === step.id
            
            return (
              <div 
                key={step.id} 
                className={`generating-step ${isComplete ? 'complete' : ''} ${isActive ? 'active' : ''}`}
              >
                <div className="step-indicator">
                  {isComplete ? (
                    <span className="step-check">✓</span>
                  ) : (
                    <span className="step-icon">{step.icon}</span>
                  )}
                </div>
                <div className="step-content">
                  <span className="step-label">{step.label}</span>
                  {isActive && (
                    <span className="step-description">{step.description}</span>
                  )}
                </div>
                {isActive && <div className="step-spinner" />}
              </div>
            )
          })}
        </div>

        {/* Progress Bar */}
        <div className="generating-progress-container">
          <div 
            className="generating-progress-bar"
            style={{ 
              width: `${Math.min((currentStep / GENERATION_STEPS.length) * 100, 95)}%` 
            }}
          />
        </div>

        {/* Timer */}
        <div className="generating-timer">
          <span className="timer-label">Elapsed:</span>
          <span className="timer-value">{formatTime(elapsedTime)}</span>
          <span className="timer-estimate">
            • Usually takes {formatTime(estimatedTime.avg)}
            {estimatedTime.samples > 0 && ` (based on ${estimatedTime.samples} requests)`}
          </span>
        </div>

        {/* Rotating Tip */}
        <div className="generating-tip">
          <p key={tipIndex} className="tip-text">{SOUND_TIPS[tipIndex]}</p>
        </div>
      </div>
    </div>
  )
}

export default GeneratingOverlay
