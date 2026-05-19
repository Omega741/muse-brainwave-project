import { useMuseWebSocket } from './hooks/useMuseWebSocket'
import BandPowerChart from './components/BandPowerChart'
import EEGWaveform    from './components/EEGWaveform'
import SleepState     from './components/SleepState'
import SignalQuality  from './components/SignalQuality'
import ArtifactPanel  from './components/ArtifactPanel'
import './App.css'

export default function App() {
  const { data, connected, mode } = useMuseWebSocket()

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <span className="logo">⚡ Muse Brainwave Monitor</span>
          <span className="mono" style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            v0.1 — local
          </span>
        </div>
        <div className="header-right">
          <span
            className="pill"
            style={{
              background: connected ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${connected ? '#10b98133' : '#ef444433'}`,
              color: connected ? '#10b981' : '#ef4444',
            }}
          >
            <span
              className="dot"
              style={{
                background: connected ? '#10b981' : '#ef4444',
                animation: connected ? 'pulse 2s infinite' : 'none',
              }}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </span>

          {data?.sleep_state && (
            <span
              className="pill"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-2)',
                color: 'var(--text)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {data.sleep_state.replace('_', ' ')}
            </span>
          )}
        </div>
      </header>

      {/* ── Grid ── */}
      <main className="grid">
        <SleepState
          state={data?.sleep_state}
          description={data?.sleep_description}
        />

        <BandPowerChart data={data} />

        <EEGWaveform data={data} />

        <SignalQuality quality={data?.signal_quality} />

        <ArtifactPanel
          artifacts={data?.artifacts}
          battery={data?.battery}
        />
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <span style={{ color: 'var(--text-muted)' }}>
          Mode:{' '}
          <span style={{ color: mode === 'real' ? '#10b981' : 'var(--text-dim)', fontWeight: mode === 'real' ? 600 : 400 }}>
            {mode === 'real' ? 'Real Headset' : 'Mock Stream'}
          </span>
          &nbsp;·&nbsp; 10 Hz &nbsp;·&nbsp; 4 EEG channels &nbsp;·&nbsp; 5 bands
        </span>
        {data?.timestamp && (
          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            t = {data.timestamp.toFixed(3)}
          </span>
        )}
      </footer>
    </div>
  )
}
