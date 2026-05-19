import { useEffect, useRef, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const BANDS = [
  { key: 'delta', color: 'var(--delta)', label: 'Delta' },
  { key: 'theta', color: 'var(--theta)', label: 'Theta' },
  { key: 'alpha', color: 'var(--alpha)', label: 'Alpha' },
  { key: 'beta',  color: 'var(--beta)',  label: 'Beta'  },
  { key: 'gamma', color: 'var(--gamma)', label: 'Gamma' },
]

const MAX_POINTS = 150

export default function BandPowerChart({ data }) {
  const bufferRef = useRef([])
  const [chart, setChart] = useState([])

  useEffect(() => {
    if (!data?.bands) return
    const point = { t: Date.now() }
    for (const { key } of BANDS) {
      point[key] = parseFloat((data.bands[key].relative * 100).toFixed(1))
    }
    bufferRef.current = [...bufferRef.current.slice(-(MAX_POINTS - 1)), point]
    setChart([...bufferRef.current])
  }, [data])

  return (
    <div className="card" style={{ gridArea: 'bands' }}>
      <div className="card-title">Band Power — Relative % (live)</div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
        {BANDS.map(({ key, color, label }) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 20, height: 2, background: color, display: 'inline-block', borderRadius: 2 }} />
            <span style={{ color: 'var(--text-dim)' }}>{label}</span>
            <span className="mono" style={{ color, fontWeight: 600 }}>
              {data?.bands?.[key] ? (data.bands[key].relative * 100).toFixed(1) + '%' : '--'}
            </span>
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="t" hide />
          <YAxis domain={[0, 70]} tickFormatter={v => v + '%'} tick={{ fontSize: 10, fill: 'var(--text-dim)' }} />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
            labelFormatter={() => ''}
            formatter={(v, name) => [v.toFixed(1) + '%', name]}
          />
          {BANDS.map(({ key, color }) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
