const STATE_CONFIG = {
  AWAKE:       { label: 'Awake',       color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   icon: '☀' },
  DROWSY:      { label: 'Drowsy',      color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   icon: '🌙' },
  LIGHT_SLEEP: { label: 'Light Sleep', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   icon: '💤' },
  DEEP_SLEEP:  { label: 'Deep Sleep',  color: '#1d4ed8', bg: 'rgba(29,78,216,0.10)',    icon: '🌊' },
  REM:         { label: 'REM',         color: '#10b981', bg: 'rgba(16,185,129,0.08)',   icon: '👁' },
}

export default function SleepState({ state, description }) {
  const cfg = STATE_CONFIG[state] ?? STATE_CONFIG.AWAKE

  return (
    <div
      className="card"
      style={{
        gridArea: 'sleep',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: cfg.bg,
        border: `1px solid ${cfg.color}33`,
        minHeight: 200,
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div className="card-title" style={{ marginBottom: 0 }}>Sleep State</div>

      <div style={{ fontSize: 48, lineHeight: 1 }}>{cfg.icon}</div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: cfg.color,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {cfg.label}
      </div>

      <div
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          maxWidth: 200,
          lineHeight: 1.5,
        }}
      >
        {description || ''}
      </div>

      <div
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          background: cfg.color,
          opacity: 0.5,
        }}
      />
    </div>
  )
}
