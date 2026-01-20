import { useState, useEffect } from 'react'

const LEARNING_STEPS = [
  { 
    id: 1, 
    label: 'Gathering Information', 
    description: 'Collecting hardware specs and characteristics',
    icon: '📋',
    duration: 1500 
  },
  { 
    id: 2, 
    label: 'Researching Hardware', 
    description: 'Claude is analyzing frequency response and sonic character',
    icon: '🔍',
    duration: 3000 
  },
  { 
    id: 3, 
    label: 'Building Recommendations', 
    description: 'Generating EQ and compression settings for different sources',
    icon: '⚙️',
    duration: 8000 
  },
  { 
    id: 4, 
    label: 'Creating Knowledge Entry', 
    description: 'Formatting settings for your database',
    icon: '💾',
    duration: 3000 
  }
]

const LEARNING_TIPS = [
  "💡 Claude researches published frequency response curves",
  "💡 Settings are tailored for live sound, not studio recording",
  "💡 Recommendations consider QuPac's specific EQ and compressor behavior",
  "💡 Amplifier learning includes power output and frequency characteristics",
  "💡 Microphone settings vary by source - vocals, instruments, speech",
  "💡 Learned settings are saved to your gear inventory automatically",
  "💡 You can re-learn any gear item to update its settings"
]

function LearningOverlay({ isVisible, hardwareType, brand, model }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [tipIndex, setTipIndex] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)

  // Progress through steps
  useEffect(() => {
    if (!isVisible) {
      setCurrentStep(1)
      setElapsedTime(0)
      return
    }

    const stepTimers = []
    let accumulated = 0

    LEARNING_STEPS.forEach((step, index) => {
      if (index > 0) {
        accumulated += LEARNING_STEPS[index - 1].duration
        const timer = setTimeout(() => {
          setCurrentStep(step.id)
        }, accumulated)
        stepTimers.push(timer)
      }
    })

    return () => stepTimers.forEach(t => clearTimeout(t))
  }, [isVisible])

  // Rotate tips
  useEffect(() => {
    if (!isVisible) return

    const tipTimer = setInterval(() => {
      setTipIndex(prev => (prev + 1) % LEARNING_TIPS.length)
    }, 4000)

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

  const getTypeEmoji = () => {
    switch (hardwareType) {
      case 'mic':
      case 'microphone':
        return '🎤'
      case 'speaker':
        return '🔊'
      case 'amplifier':
        return '🔌'
      case 'di_box':
        return '📦'
      default:
        return '🎛️'
    }
  }

  const getTypeLabel = () => {
    switch (hardwareType) {
      case 'mic':
      case 'microphone':
        return 'Microphone'
      case 'speaker':
        return 'Speaker'
      case 'amplifier':
        return 'Amplifier'
      case 'di_box':
        return 'DI Box'
      default:
        return 'Hardware'
    }
  }

  return (
    <div className="learning-overlay">
      <div className="learning-content">
        {/* Header */}
        <div className="learning-header">
          <div className="learning-icon-pulse">{getTypeEmoji()}</div>
          <h2>Learning {getTypeLabel()}</h2>
          <p className="learning-hardware-name">{brand} {model}</p>
        </div>

        {/* Progress Steps */}
        <div className="learning-steps">
          {LEARNING_STEPS.map((step) => {
            const isComplete = currentStep > step.id
            const isActive = currentStep === step.id
            
            return (
              <div 
                key={step.id} 
                className={`learning-step ${isComplete ? 'complete' : ''} ${isActive ? 'active' : ''}`}
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
        <div className="learning-progress-container">
          <div 
            className="learning-progress-bar"
            style={{ 
              width: `${Math.min((currentStep / LEARNING_STEPS.length) * 100, 95)}%` 
            }}
          />
        </div>

        {/* Timer */}
        <div className="learning-timer">
          <span className="timer-label">Elapsed:</span>
          <span className="timer-value">{formatTime(elapsedTime)}</span>
          <span className="timer-estimate">• Usually takes 10-20 seconds</span>
        </div>

        {/* Rotating Tip */}
        <div className="learning-tip">
          <p key={tipIndex} className="tip-text">{LEARNING_TIPS[tipIndex]}</p>
        </div>
      </div>
    </div>
  )
}

export default LearningOverlay
