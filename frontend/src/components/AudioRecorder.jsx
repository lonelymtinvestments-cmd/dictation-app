import { useState, useRef, useEffect } from 'react'
import AudioVisualizer from './AudioVisualizer'
import { TranscriptionStream } from '../services/api'

function AudioRecorder({
  onSegment,
  onStatusChange,
  onError,
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [streamStatus, setStreamStatus] = useState(null)

  const mediaRecorderRef = useRef(null)
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const transcriptionStreamRef = useRef(null)

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Connect to transcription WebSocket
      const transcriptionStream = new TranscriptionStream()
      transcriptionStream.onSegment = (segment) => {
        if (onSegment) onSegment(segment)
      }
      transcriptionStream.onStatus = (status) => {
        setStreamStatus(status)
        if (onStatusChange) onStatusChange(status)
      }
      transcriptionStream.onError = (error) => {
        console.error('Transcription error:', error)
        if (onError) onError(error)
      }

      await transcriptionStream.connect()
      transcriptionStreamRef.current = transcriptionStream

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current = mediaRecorder

      // Send audio chunks to server as they're available
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && transcriptionStreamRef.current) {
          await transcriptionStreamRef.current.sendAudioChunk(event.data)
        }
      }

      // Start recording with 500ms chunks for low latency
      mediaRecorder.start(500)
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

    } catch (err) {
      console.error('Error starting recording:', err)
      if (onError) onError(new Error('Could not access microphone. Please grant permission.'))
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      clearInterval(timerRef.current)

      // Tell server we're pausing
      if (transcriptionStreamRef.current) {
        transcriptionStreamRef.current.pause()
      }
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)

      // Resume timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      // Tell server we're resuming
      if (transcriptionStreamRef.current) {
        transcriptionStreamRef.current.resume()
      }
    }
  }

  const stopRecording = () => {
    // Stop MediaRecorder
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      clearInterval(timerRef.current)

      // Stop all audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }

    // Tell server we're done and close connection
    if (transcriptionStreamRef.current) {
      transcriptionStreamRef.current.stop()
      // Give server time to flush, then close
      setTimeout(() => {
        if (transcriptionStreamRef.current) {
          transcriptionStreamRef.current.close()
          transcriptionStreamRef.current = null
        }
      }, 2000)
    }
  }

  const handleClear = () => {
    setRecordingTime(0)
    setStreamStatus(null)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (transcriptionStreamRef.current) {
        transcriptionStreamRef.current.close()
      }
    }
  }, [])

  const getStatusDisplay = () => {
    if (!isRecording && !streamStatus) return null

    if (isPaused) {
      return (
        <div className="status status-paused">
          <span className="pulse-paused"></span>
          Paused
        </div>
      )
    }

    if (streamStatus === 'transcribing') {
      return (
        <div className="status status-processing">
          <span className="spinner"></span>
          Transcribing...
        </div>
      )
    }

    if (streamStatus === 'listening' || isRecording) {
      return (
        <div className="status status-recording">
          <span className="pulse"></span>
          Listening...
        </div>
      )
    }

    return null
  }

  return (
    <div className="audio-recorder">
      <AudioVisualizer
        stream={isRecording && !isPaused ? streamRef.current : null}
        audioBlob={null}
      />

      <div className="recording-time">{formatTime(recordingTime)}</div>

      {getStatusDisplay()}

      <div className="recording-controls">
        {!isRecording && (
          <button className="btn btn-primary" onClick={startRecording}>
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
      </div>
    </div>
  )
}

export default AudioRecorder
