import { useState, useEffect } from 'react'
import AudioRecorder from './components/AudioRecorder'
import TranscriptViewer from './components/TranscriptViewer'
import Settings from './components/Settings'
import { checkHealth } from './services/api'

function App() {
  const [transcript, setTranscript] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState({
    transcriptionMethod: 'local',
    enableDiarization: true,
    language: null, // auto-detect
  })
  const [health, setHealth] = useState(null)
  const [googleToken, setGoogleToken] = useState(null)

  useEffect(() => {
    // Check backend health on mount
    checkHealth()
      .then(setHealth)
      .catch((err) => {
        console.error('Health check failed:', err)
        setError('Cannot connect to backend. Make sure the server is running.')
      })
  }, [])

  const handleTranscriptionComplete = (result) => {
    setTranscript(result)
    setIsProcessing(false)
    setError(null)
  }

  const handleTranscriptionError = (err) => {
    setError(err.message || 'Transcription failed')
    setIsProcessing(false)
  }

  const handleTranscriptionStart = () => {
    setIsProcessing(true)
    setError(null)
  }

  const handleGoogleLogin = (token) => {
    setGoogleToken(token)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Dictation App</h1>
        <p>Record, transcribe, and save your meetings</p>
      </header>

      {error && (
        <div className="message message-error">
          {error}
        </div>
      )}

      {health && !health.whisper_available && settings.transcriptionMethod === 'local' && (
        <div className="message message-info">
          Local Whisper not available. Switch to cloud transcription in settings or install openai-whisper.
        </div>
      )}

      <div className="main-content">
        <div className="left-column">
          <div className="card">
            <h2>Recording</h2>
            <AudioRecorder
              settings={settings}
              onTranscriptionStart={handleTranscriptionStart}
              onTranscriptionComplete={handleTranscriptionComplete}
              onTranscriptionError={handleTranscriptionError}
              isProcessing={isProcessing}
            />
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <h2>Settings</h2>
            <Settings
              settings={settings}
              onSettingsChange={setSettings}
              health={health}
              googleToken={googleToken}
              onGoogleLogin={handleGoogleLogin}
            />
          </div>
        </div>

        <div className="right-column">
          <div className="card">
            <h2>Transcript</h2>
            <TranscriptViewer
              transcript={transcript}
              isProcessing={isProcessing}
              googleToken={googleToken}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
