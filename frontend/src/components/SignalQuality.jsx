const ELECTRODES = [
  { key: 'eeg1', label: 'TP9',  pos: 'L Ear'  },
  { key: 'eeg2', label: 'AF7',  pos: 'L Fore'  },
  { key: 'eeg3', label: 'AF8',  pos: 'R Fore'  },
  { key: 'eeg4', label: 'TP10', pos: 'R Ear'   },
]

function qualityColor(v) {
  if (v === 1) return '#10b981'
  if (v === 2) return '#f59e0b'
  return '#ef4444'
}

function qualityLabel(v) {
  if (v === 1) return 'Good'
  if (v === 2) return 'Fair'
  return 'Poor'
}

export default function SignalQuality({ quality }) {
  return (
    <div className="card" style={{ gridArea: 'quality' }}>
      <div className="card-title">Signal Quality</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ELECTRODES.map(({ key, label, pos }) => {
          const v     = quality?.[key] ?? 1
          const color = qualityColor(v)
          const pct   = v === 1 ? 100 : v === 2 ? 55 : 20

          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    className="dot"
                    style={{
                      background: color,
                      boxShadow: `0 0 6px ${color}`,
                      animation: v === 1 ? 'none' : 'pulse 1.2s infinite',
                    }}
                  />
                  <span style={{ fontWeight: 500 }}>{label}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{pos}</span>
                </span>
                <span style={{ color, fontSize: 11, fontWeight: 600 }}>{qualityLabel(v)}</span>
              </div>
              <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: pct + '%',
                    background: color,
                    borderRadius: 2,
                    transition: 'width 0.4s ease, background 0.4s ease',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
