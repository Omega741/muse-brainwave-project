import { useEffect, useRef } from 'react'

// Frequency axis: 1–44 Hz (44 bins, 1 Hz resolution from Welch nperseg=256)
const FREQ_MIN  = 1
const FREQ_MAX  = 44
const N_FREQS   = 44
const DB_MIN    = -10
const DB_MAX    = 40
const HISTORY   = 300   // columns kept in memory (~30 s at 10 Hz)

// Plasma colormap key stops [R, G, B] at t = 0, 0.14, 0.29, 0.43, 0.57, 0.71, 0.86, 1.0
const PLASMA = [
  [13,   8, 135],
  [84,   2, 163],
  [139, 10, 165],
  [185, 50, 137],
  [219, 92, 104],
  [244,136,  73],
  [254,188,  43],
  [240,249,  33],
]

function plasmaRGB(t) {
  t = Math.max(0, Math.min(1, t))
  const s  = t * (PLASMA.length - 1)
  const lo = Math.floor(s)
  const hi = Math.min(lo + 1, PLASMA.length - 1)
  const f  = s - lo
  return PLASMA[lo].map((c, i) => Math.round(c + f * (PLASMA[hi][i] - c)))
}

// Frequency band boundary lines (Hz) and labels
const BAND_LINES  = [4, 8, 13, 30]
const BAND_LABELS = [
  { label: 'δ', hz: 2   },
  { label: 'θ', hz: 6   },
  { label: 'α', hz: 10  },
  { label: 'β', hz: 21  },
  { label: 'γ', hz: 37  },
]
const HZ_TICKS = [1, 4, 8, 13, 30, 44]

export default function Spectrogram({ data }) {
  const canvasRef  = useRef(null)
  const histRef    = useRef([])       // Float32Array columns
  const observerRef = useRef(null)

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    const PL = 36, PR = 8, PT = 6, PB = 18
    const plotW = W - PL - PR
    const plotH = H - PT - PB

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#05050a'
    ctx.fillRect(PL, PT, plotW, plotH)

    const hist = histRef.current
    if (hist.length === 0) {
      ctx.fillStyle = 'rgba(100,116,139,0.4)'
      ctx.font = '11px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for signal…', PL + plotW / 2, PT + plotH / 2)
    } else {
      // Each column is 1px wide; scroll window = plotW columns
      const cols = Math.min(hist.length, plotW)
      const colW = plotW / cols
      const binH = plotH / N_FREQS

      // Pre-build ImageData for the plot area for speed
      const imgData = ctx.createImageData(plotW, plotH)
      const px = imgData.data

      for (let col = 0; col < cols; col++) {
        const spectrum = hist[hist.length - cols + col]
        const x0 = Math.round(col * colW)
        const x1 = Math.round((col + 1) * colW)

        for (let fi = 0; fi < N_FREQS; fi++) {
          const db  = spectrum[fi] ?? DB_MIN
          const t   = (db - DB_MIN) / (DB_MAX - DB_MIN)
          const [r, g, b] = plasmaRGB(t)

          // fi=0 → 1 Hz at bottom; canvas Y increases downward
          const y0 = Math.round(plotH - (fi + 1) * binH)
          const y1 = Math.round(plotH - fi * binH)

          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const idx = (y * plotW + x) * 4
              px[idx]     = r
              px[idx + 1] = g
              px[idx + 2] = b
              px[idx + 3] = 255
            }
          }
        }
      }
      ctx.putImageData(imgData, PL, PT)
    }

    // Band boundary lines
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'
    ctx.lineWidth = 1
    for (const hz of BAND_LINES) {
      const fi = hz - FREQ_MIN
      const y  = PT + plotH - (fi / N_FREQS) * plotH
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + plotW, y); ctx.stroke()
    }

    // Band name labels (left edge)
    ctx.fillStyle = 'rgba(203,213,225,0.55)'
    ctx.font = '9px Inter, sans-serif'
    ctx.textAlign = 'left'
    for (const { label, hz } of BAND_LABELS) {
      const fi = hz - FREQ_MIN
      const y  = PT + plotH - (fi / N_FREQS) * plotH
      ctx.fillText(label, PL + 4, y + 3)
    }

    // Y-axis Hz ticks
    ctx.fillStyle = 'rgba(100,116,139,0.9)'
    ctx.font = '9px Inter, sans-serif'
    ctx.textAlign = 'right'
    for (const hz of HZ_TICKS) {
      const fi = hz - FREQ_MIN
      const y  = PT + plotH - (fi / N_FREQS) * plotH
      ctx.fillText(`${hz}`, PL - 4, y + 3)
    }

    // Hz axis label
    ctx.save()
    ctx.translate(10, PT + plotH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillStyle = 'rgba(100,116,139,0.7)'
    ctx.font = '9px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Hz', 0, 0)
    ctx.restore()

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(PL, PT, plotW, plotH)

    // dB scale label
    ctx.fillStyle = 'rgba(100,116,139,0.6)'
    ctx.font = '9px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${DB_MIN} → ${DB_MAX} dB`, W - PR, H - 4)
  }

  useEffect(() => {
    if (!data?.spectrum) return
    const hist = histRef.current
    hist.push(new Float32Array(data.spectrum))
    if (hist.length > HISTORY) hist.shift()
    draw()
  }, [data])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function fit() {
      canvas.width  = canvas.parentElement.clientWidth
      canvas.height = 200
      draw()
    }

    observerRef.current = new ResizeObserver(fit)
    observerRef.current.observe(canvas.parentElement)
    fit()
    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <div className="card" style={{ gridArea: 'spectrogram' }}>
      <div className="card-title">
        EEG Spectrogram — 1–44 Hz
        <span style={{ float: 'right', fontWeight: 400, color: 'var(--text-muted)', fontSize: 9 }}>
          plasma · {DB_MIN} to {DB_MAX} dB
        </span>
      </div>
      <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />
    </div>
  )
}
