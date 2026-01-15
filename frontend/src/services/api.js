import axios from 'axios'

const API_BASE = 'http://localhost:8001'

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
