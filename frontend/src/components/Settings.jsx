import { useGoogleLogin } from '@react-oauth/google'

function Settings({ settings, onSettingsChange, health, googleToken, onGoogleLogin }) {
  const handleMethodChange = (e) => {
    onSettingsChange({ ...settings, transcriptionMethod: e.target.value })
  }

  const handleDiarizationChange = (e) => {
    onSettingsChange({ ...settings, enableDiarization: e.target.checked })
  }

  const handleLanguageChange = (e) => {
    const value = e.target.value === '' ? null : e.target.value
    onSettingsChange({ ...settings, language: value })
  }

  const login = useGoogleLogin({
    onSuccess: (response) => {
      onGoogleLogin(response.access_token)
    },
    onError: (error) => {
      console.error('Google login failed:', error)
    },
    scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
  })

  return (
    <div className="settings">
      <div className="form-group">
        <label>Transcription Method</label>
        <select value={settings.transcriptionMethod} onChange={handleMethodChange}>
          <option value="local">Local (Whisper)</option>
          <option value="cloud">Cloud (OpenAI API)</option>
        </select>
        {health && settings.transcriptionMethod === 'local' && !health.whisper_available && (
          <small style={{ color: 'var(--danger)', display: 'block', marginTop: '0.25rem' }}>
            Local Whisper not available
          </small>
        )}
        {health && settings.transcriptionMethod === 'cloud' && !health.whisper_available && (
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
            Requires OPENAI_API_KEY in backend
          </small>
        )}
      </div>

      <div className="settings-row">
        <label>Speaker Diarization</label>
        <input
          type="checkbox"
          checked={settings.enableDiarization}
          onChange={handleDiarizationChange}
          style={{ width: 'auto' }}
        />
      </div>
      {health && settings.enableDiarization && !health.diarization_available && (
        <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '1rem' }}>
          Diarization requires HF_TOKEN in backend
        </small>
      )}

      <div className="form-group">
        <label>Language</label>
        <select value={settings.language || ''} onChange={handleLanguageChange}>
          <option value="">Auto-detect</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese</option>
          <option value="ko">Korean</option>
        </select>
      </div>

      <div className="form-group" style={{ marginTop: '1.5rem' }}>
        <label>Google Docs Integration</label>
        {googleToken ? (
          <div className="status status-ready" style={{ marginTop: '0.5rem' }}>
            Connected to Google
          </div>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => login()}
            style={{ marginTop: '0.5rem', width: '100%' }}
          >
            Connect Google Account
          </button>
        )}
        {!health?.google_docs_available && (
          <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
            Google OAuth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend
          </small>
        )}
      </div>
    </div>
  )
}

export default Settings
