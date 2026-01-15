import { useState, useRef, useEffect, useCallback } from 'react'
import AudioVisualizer from './AudioVisualizer'
import { transcribeAudio } from '../services/api'

function AudioRecorder({
  settings,
  onTranscriptionStart,
  onTranscriptionComplete,
  onTranscriptionError,
  isProcessing,
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
      }

      mediaRecorder.start(1000) // Collect data every second
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error accessing microphone:', err)
      onTranscriptionError(new Error('Could not access microphone. Please grant permission.'))
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      clearInterval(timerRef.current)
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      clearInterval(timerRef.current)

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }

  const handleTranscribe = async () => {
    if (!audioBlob) return

    onTranscriptionStart()

    try {
      const result = await transcribeAudio(audioBlob, settings)
      onTranscriptionComplete(result)
    } catch (err) {
      console.error('Transcription failed:', err)
      onTranscriptionError(err.response?.data?.detail || err.message)
    }
  }

  const handleClear = () => {
    setAudioBlob(null)
    setRecordingTime(0)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <div className="audio-recorder">
      <AudioVisualizer
        stream={isRecording && !isPaused ? streamRef.current : null}
        audioBlob={audioBlob}
      />

      <div className="recording-time">{formatTime(recordingTime)}</div>

      {isRecording && (
        <div className="status status-recording">
          <span className="pulse"></span>
          {isPaused ? 'Paused' : 'Recording'}
        </div>
      )}

      {isProcessing && (
        <div className="status status-processing">
          <span className="spinner"></span>
          Processing...
        </div>
      )}

      <div className="recording-controls">
        {!isRecording && !audioBlob && (
          <button className="btn btn-primary" onClick={startRecording} disabled={isProcessing}>
            Start Recording
          </button>
        )}

        {isRecording && !isPaused && (
          <>
            <button className="btn btn-secondary" onClick={pauseRecording}>
              Pause
            </button>
            <button className="btn btn-danger" onClick={stopRecording}>
              Stop
            </button>
          </>
        )}

        {isRecording && isPaused && (
          <>
            <button className="btn btn-primary" onClick={resumeRecording}>
              Resume
            </button>
            <button className="btn btn-danger" onClick={stopRecording}>
              Stop
            </button>
          </>
        )}

        {audioBlob && !isRecording && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleTranscribe}
              disabled={isProcessing}
            >
              {isProcessing ? 'Transcribing...' : 'Transcribe'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleClear}
              disabled={isProcessing}
            >
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default AudioRecorder
