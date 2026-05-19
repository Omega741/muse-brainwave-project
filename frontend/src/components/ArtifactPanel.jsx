import { useEffect, useRef, useState } from 'react'

function Indicator({ label, active, color, icon, flash }) {
  const [lit, setLit] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (active && flash) {
      setLit(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setLit(false), 500)
    } else if (!flash) {
      setLit(active)
    }
  }, [active, flash])

  const on = flash ? lit : active

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 10,
        background: on ? `${color}18` : 'var(--surface-2)',
        border: `1px solid ${on ? color + '55' : 'transparent'}`,
        transition: 'all 0.2s ease',
        flex: 1,
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span
        className="dot"
        style={{
          background: on ? color : 'var(--text-muted)',
          boxShadow: on ? `0 0 8px ${color}` : 'none',
          transition: 'all 0.15s ease',
        }}
      />
      <span style={{ fontSize: 10, color: on ? color : 'var(--text-dim)', fontWeight: 600, textAlign: 'center' }}>
        {label}
      </span>
    </div>
  )
}

export default function ArtifactPanel({ artifacts, battery }) {
  return (
    <div className="card" style={{ gridArea: 'artifacts' }}>
      <div className="card-title">Artifacts & Status</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Indicator
          label="Headband On"
          active={artifacts?.headband_on ?? false}
          color="#10b981"
          icon="🎧"
          flash={false}
        />
        <Indicator
          label="Blink"
          active={artifacts?.blink ?? false}
          color="#3b82f6"
          icon="👁"
          flash
        />
        <Indicator
          label="Jaw Clench"
          active={artifacts?.jaw_clench ?? false}
          color="#ef4444"
          icon="😬"
          flash
        />
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Battery</span>
          <span
            className="mono"
            style={{
              color: battery > 30 ? '#10b981' : '#ef4444',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            {battery ?? '--'}%
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${battery ?? 0}%`,
              background: battery > 30 ? '#10b981' : '#ef4444',
              borderRadius: 2,
              transition: 'width 1s ease',
            }}
          />
        </div>
      </div>
    </div>
  )
}
