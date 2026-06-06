import { useEffect, useRef, useState } from 'react'

const WINDOW = 120

export function useLiveTelemetry() {
  const [latest, setLatest] = useState(null)
  const [series, setSeries] = useState([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    let closed = false
    let retry

    function connect() {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/live`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!closed) retry = setTimeout(connect, 1500)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (event) => {
        const sample = JSON.parse(event.data)
        setLatest(sample)
        setSeries((prev) => {
          const point = { ...sample, t: new Date(sample.timestamp * 1000) }
          const next = [...prev, point]
          return next.length > WINDOW ? next.slice(next.length - WINDOW) : next
        })
      }
    }

    connect()
    return () => {
      closed = true
      clearTimeout(retry)
      wsRef.current?.close()
    }
  }, [])

  return { latest, series, connected }
}
