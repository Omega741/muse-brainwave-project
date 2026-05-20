import { useEffect, useRef } from 'react'

const CHANNELS = ['eeg1', 'eeg2', 'eeg3', 'eeg4']
const LABELS   = ['TP9 (L Ear)', 'AF7 (L Fore)', 'AF8 (R Fore)', 'TP10 (R Ear)']
const COLORS   = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']
const BUF_SIZE = 200

export default function EEGWaveform({ data }) {
  const canvasRef    = useRef(null)
  const bufRef       = useRef({ eeg1: [], eeg2: [], eeg3: [], eeg4: [] })
  const observerRef  = useRef(null)

  // Resize canvas resolution to match its actual CSS pixel size
  function fitCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width } = canvas.getBoundingClientRect()
    if (canvas.width !== Math.round(width)) {
      canvas.width = Math.round(width)
    }
  }

  // Watch container size and redraw whenever it changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    fitCanvas()
    observerRef.current = new ResizeObserver(() => { fitCanvas(); draw() })
    observerRef.current.observe(canvas.parentElement)
    return () => observerRef.current?.disconnect()
  }, [])

  useEffect(() => {
    if (!data?.raw_eeg) return
    for (const ch of CHANNELS) {
      const buf = bufRef.current[ch]
      buf.push(data.raw_eeg[ch])
      if (buf.length > BUF_SIZE) buf.shift()
    }
    draw()
  }, [data])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W   = canvas.width
    const H   = canvas.height
    const chH = H / CHANNELS.length

    ctx.clearRect(0, 0, W, H)

    CHANNELS.forEach((ch, i) => {
      const buf = bufRef.current[ch]
      const y0  = i * chH + chH / 2

      if (i > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, i * chH)
        ctx.lineTo(W, i * chH)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, y0)
      ctx.lineTo(W, y0)
      ctx.stroke()

      ctx.fillStyle = COLORS[i]
      ctx.font = '10px Inter'
      ctx.fillText(LABELS[i], 8, i * chH + 14)

      if (buf.length < 2) return

      const sorted = [...buf].map(Math.abs).sort((a, b) => a - b)
      const p95    = sorted[Math.floor(sorted.length * 0.95)] || 50
      const range  = Math.max(p95 * 1.2, 30)
      const scale  = (chH * 0.42) / range

      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.font = '9px JetBrains Mono, monospace'
      ctx.fillText(`±${Math.round(range)}µV`, W - 54, i * chH + 13)

      ctx.strokeStyle = COLORS[i]
      ctx.lineWidth = 1.4
      ctx.beginPath()
      buf.forEach((v, j) => {
        const x = (j / BUF_SIZE) * W
        const y = y0 - v * scale
        j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
    })
  }

  return (
    <div className="card" style={{ gridArea: 'eeg' }}>
      <div className="card-title">Raw EEG — 4 Channels (µV)</div>
      <canvas
        ref={canvasRef}
        height={200}
        style={{ width: '100%', height: 200, display: 'block' }}
      />
    </div>
  )
}
