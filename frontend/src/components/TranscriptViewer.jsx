import { useState, useEffect, useRef } from 'react'
import { saveToGoogleDocs } from '../services/api'

function TranscriptViewer({ transcript, isProcessing, isListening, googleToken }) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const transcriptRef = useRef(null)

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    if (transcriptRef.current && transcript?.segments?.length > 0) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript?.segments?.length])

  const formatTimestamp = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getSpeakerClass = (speaker) => {
    const speakerNum = speaker.match(/\d+/)
    if (speakerNum) {
      const num = parseInt(speakerNum[0]) % 4 + 1
      return `speaker-${num}`
    }
    return 'speaker-unknown'
  }

  const handleSaveToGoogleDocs = async () => {
    if (!transcript || !googleToken) return

    setIsSaving(true)
    setSaveSuccess(null)
    setSaveError(null)

    try {
      const result = await saveToGoogleDocs(transcript, googleToken)
      setSaveSuccess(result)
    } catch (err) {
      console.error('Failed to save to Google Docs:', err)
      setSaveError(err.response?.data?.detail || err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCopyToClipboard = () => {
    if (!transcript) return

    let text = transcript.segments
      .map((seg) => `[${formatTimestamp(seg.start_time)}] ${seg.speaker}:\n${seg.text}`)
      .join('\n\n')

    navigator.clipboard.writeText(text)
  }

  // Show listening indicator
  if (isListening && (!transcript || transcript.segments.length === 0)) {
    return (
      <div className="transcript">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="listening-indicator">
            <span className="listening-dot"></span>
            <span className="listening-dot"></span>
            <span className="listening-dot"></span>
          </div>
          <p style={{ marginTop: '1rem' }}>Listening...</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Start speaking and your words will appear here
          </p>
        </div>
      </div>
    )
  }

  // Show processing indicator
  if (isProcessing && (!transcript || transcript.segments.length === 0)) {
    return (
      <div className="transcript">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p>Processing audio...</p>
        </div>
      </div>
    )
  }

  // Show empty state
  if (!transcript || transcript.segments.length === 0) {
    return (
      <div className="transcript">
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <p>No transcript yet</p>
          <p style={{ fontSize: '0.875rem' }}>
            Click Start Recording to begin
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {saveSuccess && (
        <div className="message message-success">
          Saved to Google Docs!{' '}
          <a href={saveSuccess.document_url} target="_blank" rel="noopener noreferrer">
            Open document
          </a>
        </div>
      )}

      {saveError && (
        <div className="message message-error">
          Failed to save: {saveError}
        </div>
      )}

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-secondary" onClick={handleCopyToClipboard}>
          Copy to Clipboard
        </button>
        {googleToken && (
          <button
            className="btn btn-primary"
            onClick={handleSaveToGoogleDocs}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save to Google Docs'}
          </button>
        )}
      </div>

      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Duration: {formatTimestamp(transcript.duration)} |
        Segments: {transcript.segments.length}
        {isListening && <span style={{ marginLeft: '0.5rem', color: 'var(--success)' }}>● Live</span>}
      </div>

      <div className="transcript" ref={transcriptRef}>
        {transcript.segments.map((segment, index) => (
          <div key={index} className="transcript-segment">
            <span className={`speaker-label ${getSpeakerClass(segment.speaker)}`}>
              {segment.speaker}
            </span>
            <span className="timestamp">
              {formatTimestamp(segment.start_time)} - {formatTimestamp(segment.end_time)}
            </span>
            <p className="segment-text">{segment.text}</p>
          </div>
        ))}

        {/* Show typing indicator when listening and has content */}
        {isListening && (
          <div className="transcript-segment typing-indicator">
            <span className="listening-dot"></span>
            <span className="listening-dot"></span>
            <span className="listening-dot"></span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TranscriptViewer
