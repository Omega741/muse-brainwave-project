import { useEffect, useRef, useState } from 'react'

const WS_URL     = 'ws://localhost:8000/ws'
const HEALTH_URL = 'http://localhost:8000/health'
const STALE_MS   = 4000  // mark headset gone if no packet for 4s

export function useMuseWebSocket() {
  const [data, setData]                   = useState(null)
  const [wsConnected, setWsConn]          = useState(false)
  const [headsetConnected, setHeadset]    = useState(false)
  const [mode, setMode]                   = useState('mock')
  const wsRef                             = useRef(null)
  const retryRef                          = useRef(null)
  const heartbeatRef                      = useRef(null)
  const retryDelay                        = useRef(1000)

  useEffect(() => {
    fetch(HEALTH_URL)
      .then(r => r.json())
      .then(d => setMode(d.mode ?? 'mock'))
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true

    function armHeartbeat() {
      clearTimeout(heartbeatRef.current)
      heartbeatRef.current = setTimeout(() => setHeadset(false), STALE_MS)
    }

    function connect() {
      if (!alive) return
      const ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        if (!alive) { ws.close(); return }
        setWsConn(true)
        retryDelay.current = 1000
      }

      ws.onmessage = (e) => {
        if (!alive) return
        try {
          const packet = JSON.parse(e.data)
          setData(packet)
          const up = packet.connection === 'CONNECTED'
          setHeadset(up)
          if (up) armHeartbeat()
          else clearTimeout(heartbeatRef.current)
        } catch {}
      }

      ws.onclose = () => {
        setWsConn(false)
        setHeadset(false)
        clearTimeout(heartbeatRef.current)
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
      clearTimeout(heartbeatRef.current)
      wsRef.current?.close()
    }
  }, [])

  // Legacy: expose `connected` as the headset state so existing components
  // that read `connected` keep working without changes.
  return { data, connected: headsetConnected, wsConnected, headsetConnected, mode }
}
