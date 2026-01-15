import { useState, useEffect, useCallback } from 'react'
import AudioRecorder from './components/AudioRecorder'
import TranscriptViewer from './components/TranscriptViewer'
import Settings from './components/Settings'
import { checkHealth } from './services/api'

function App() {
  const [segments, setSegments] = useState([])
  const [streamStatus, setStreamStatus] = useState(null)
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState({
    transcriptionMethod: 'local',
    enableDiarization: true,
    language: null,
  })
  const [health, setHealth] = useState(null)
  const [googleToken, setGoogleToken] = useState(null)

  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch((err) => {
        console.error('Health check failed:', err)
        setError('Cannot connect to backend. Make sure the server is running.')
      })
  }, [])

  // Handle new segment from streaming transcription
  const handleSegment = useCallback((segment) => {
    setSegments((prev) => [...prev, {
      speaker: segment.speaker || 'Speaker',
      start_time: segment.start,
      end_time: segment.end,
      text: segment.text,
    }])
    setError(null)
  }, [])

  // Handle status changes from streaming
  const handleStatusChange = useCallback((status) => {
    setStreamStatus(status)
  }, [])

  // Handle errors
  const handleError = useCallback((err) => {
    setError(err.message || 'Transcription failed')
  }, [])

  // Handle Google login
  const handleGoogleLogin = (token) => {
    setGoogleToken(token)
  }

  // Clear transcript
  const handleClear = () => {
    setSegments([])
    setStreamStatus(null)
    setError(null)
  }

  // Build transcript object for display
  const transcript = segments.length > 0 ? {
    segments,
    duration: segments.length > 0 ? segments[segments.length - 1].end_time : 0,
    text: segments.map(s => s.text).join(' '),
  } : null

  return (
    <div className="app">
      <header className="header">
        <h1>Dictation App</h1>
        <p>Real-time speech transcription</p>
      </header>

      {error && (
        <div className="message message-error">
          {error}
        </div>
      )}

      {health && !health.whisper_available && (
        <div className="message message-info">
          Local Whisper not available. Install faster-whisper to enable transcription.
        </div>
      )}

      <div className="main-content">
        <div className="left-column">
          <div className="card">
            <h2>Recording</h2>
            <AudioRecorder
              onSegment={handleSegment}
              onStatusChange={handleStatusChange}
              onError={handleError}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Transcript</h2>
              {segments.length > 0 && (
                <button className="btn btn-secondary" onClick={handleClear} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                  Clear
                </button>
              )}
            </div>
            <TranscriptViewer
              transcript={transcript}
              isProcessing={streamStatus === 'transcribing'}
              isListening={streamStatus === 'listening'}
              googleToken={googleToken}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
