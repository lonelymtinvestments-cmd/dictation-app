import axios from 'axios'

const API_BASE = 'http://localhost:8001'
const WS_BASE = 'ws://localhost:8001'

const api = axios.create({
  baseURL: API_BASE,
})

export async function checkHealth() {
  const response = await api.get('/health')
  return response.data
}

export async function transcribeAudio(audioBlob, settings) {
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.webm')

  const params = new URLSearchParams()
  params.append('method', settings.transcriptionMethod)
  params.append('enable_diarization', settings.enableDiarization)
  if (settings.language) {
    params.append('language', settings.language)
  }

  const response = await api.post(`/transcribe?${params.toString()}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

export async function saveToGoogleDocs(transcript, accessToken, title = null, folderId = null) {
  const params = new URLSearchParams()
  params.append('access_token', accessToken)

  const response = await api.post(`/save-to-docs?${params.toString()}`, {
    transcript,
    title,
    folder_id: folderId,
  })

  return response.data
}

export async function listGoogleFolders(accessToken) {
  const params = new URLSearchParams()
  params.append('access_token', accessToken)

  const response = await api.get(`/google/folders?${params.toString()}`)
  return response.data.folders
}

/**
 * WebSocket client for real-time streaming transcription.
 */
export class TranscriptionStream {
  constructor() {
    this.ws = null
    this.onSegment = null
    this.onStatus = null
    this.onError = null
  }

  /**
   * Connect to the transcription WebSocket.
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${WS_BASE}/ws/transcribe`)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        resolve()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        if (this.onError) this.onError(error)
        reject(error)
      }

      this.ws.onclose = () => {
        console.log('WebSocket closed')
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'segment' && this.onSegment) {
            this.onSegment(message.data)
          } else if (message.type === 'status' && this.onStatus) {
            this.onStatus(message.status)
          } else if (message.type === 'error' && this.onError) {
            this.onError(new Error(message.message))
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }
    })
  }

  /**
   * Send an audio chunk to the server.
   * @param {Blob} audioBlob - Audio data blob
   */
  async sendAudioChunk(audioBlob) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected')
      return
    }

    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    this.ws.send(JSON.stringify({
      type: 'audio',
      data: base64
    }))
  }

  /**
   * Pause transcription (keeps connection open).
   */
  pause() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'pause' }))
    }
  }

  /**
   * Resume transcription after pause.
   */
  resume() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'resume' }))
    }
  }

  /**
   * Stop transcription and close connection.
   */
  stop() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop' }))
    }
  }

  /**
   * Close the WebSocket connection.
   */
  close() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Check if WebSocket is connected.
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN
  }
}
