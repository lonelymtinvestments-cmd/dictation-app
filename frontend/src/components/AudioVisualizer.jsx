import { useEffect, useRef } from 'react'

function AudioVisualizer({ stream, audioBlob }) {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const analyserRef = useRef(null)

  useEffect(() => {
    if (!stream) {
      // Clear canvas when not recording
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#f8fafc'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw center line
        ctx.strokeStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)
        ctx.lineTo(canvas.width, canvas.height / 2)
        ctx.stroke()
      }
      return
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256

    const source = audioContext.createMediaStreamSource(stream)
    source.connect(analyser)

    analyserRef.current = analyser

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)

      analyser.getByteFrequencyData(dataArray)

      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8

        // Gradient from primary to primary-dark
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight)
        gradient.addColorStop(0, '#4f46e5')
        gradient.addColorStop(1, '#818cf8')

        ctx.fillStyle = gradient
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)

        x += barWidth + 1
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(animationRef.current)
      audioContext.close()
    }
  }, [stream])

  // Display static waveform for recorded audio
  useEffect(() => {
    if (audioBlob && !stream) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')

      // Simple representation of recorded audio
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#4f46e5'
      ctx.fillRect(20, canvas.height / 2 - 20, canvas.width - 40, 40)

      ctx.fillStyle = '#818cf8'
      ctx.fillRect(20, canvas.height / 2 - 10, canvas.width - 40, 20)
    }
  }, [audioBlob, stream])

  return (
    <div className="waveform-container">
      <canvas
        ref={canvasRef}
        width={500}
        height={100}
        style={{ width: '100%', height: '100px' }}
      />
    </div>
  )
}

export default AudioVisualizer
