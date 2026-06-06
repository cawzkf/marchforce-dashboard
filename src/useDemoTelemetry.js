import { useEffect, useRef, useState } from 'react'

const A = 120
const B = 70
const PERIM = Math.PI * (3 * (A + B) - Math.sqrt((3 * A + B) * (A + 3 * B)))
const WINDOW = 120

function profile(t) {
  if (t < 15) return [2.0, 2.0 * t]
  if (t < 40) return [0.0, 30.0]
  const v = Math.max(0, 30 - 1.5 * (t - 40))
  return [v === 0 ? 0 : -1.5, v]
}

export function useDemoTelemetry(enabled) {
  const [latest, setLatest] = useState(null)
  const [series, setSeries] = useState([])
  const st = useRef({ t: 0, dist: 0, energy: 0, soc: 1.0 })

  useEffect(() => {
    if (!enabled) return undefined
    const dt = 0.1
    const id = setInterval(() => {
      const s = st.current
      const [acc, vel] = profile(s.t % 60)
      const theta = (s.dist / PERIM) * 2 * Math.PI
      const x = A * Math.cos(theta)
      const y = B * Math.sin(theta)
      const fAero = 0.5 * 1.225 * 0.3 * 2.2 * vel * vel
      const fRoll = 0.015 * 1500 * 9.81
      const power = Math.max(0, (1500 * acc + fAero + fRoll) * vel)
      s.energy += power * dt
      s.soc = Math.max(0, s.soc - (power * dt) / 0.9 / 50000000)
      const vdc = 48 * (0.95 + 0.1 * s.soc)
      const idc = power / 0.9 / vdc
      const alerts = idc > 100
        ? [{ code: 'E-IDC-OVERCURRENT', severity: 'error', message: 'Sobrecorrente no barramento DC', value: Math.round(idc) }]
        : []
      const sample = {
        session_id: 'demo', timestamp: Date.now() / 1000,
        velocity: vel, acceleration: acc, vdc, idc, power,
        energy: s.energy, soc: s.soc, distance: s.dist,
        avg_power: power, specific_consumption: s.dist ? (s.energy / 3600) / s.dist : 0,
        autonomy: power > 0 ? (s.soc * 50000000) / power : 0, x, y, alerts,
      }
      setLatest(sample)
      setSeries((prev) => {
        const next = [...prev, sample]
        return next.length > WINDOW ? next.slice(next.length - WINDOW) : next
      })
      s.dist += vel * dt
      s.t += dt
    }, 100)
    return () => clearInterval(id)
  }, [enabled])

  return { latest, series, connected: false }
}
