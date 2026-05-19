import { useEffect, useRef, useState } from 'react'

const WS_URL     = 'ws://localhost:8000/ws'
const HEALTH_URL = 'http://localhost:8000/health'

export function useMuseWebSocket() {
  const [data, setData]       = useState(null)
  const [connected, setConn]  = useState(false)
  const [mode, setMode]       = useState('mock')
  const wsRef                 = useRef(null)
  const retryRef              = useRef(null)
  const retryDelay            = useRef(1000)

  // Fetch mode from health endpoint once on mount
  useEffect(() => {
    fetch(HEALTH_URL)
      .then(r => r.json())
      .then(d => setMode(d.mode ?? 'mock'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true

    function connect() {
      if (!alive) return
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        if (!alive) { ws.close(); return }
        setConn(true)
        retryDelay.current = 1000
      }

      ws.onmessage = (e) => {
        if (!alive) return
        try { setData(JSON.parse(e.data)) } catch {}
      }

      ws.onclose = () => {
        setConn(false)
        if (!alive) return
        retryRef.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 1.5, 8000)
          connect()
        }, retryDelay.current)
      }

      ws.onerror = () => ws.close()
      wsRef.current = ws
    }

    connect()
    return () => {
      alive = false
      clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [])

  return { data, connected, mode }
}
