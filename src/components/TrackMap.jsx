import { useMemo, useRef, useState } from 'react'
import { has, kmh, num } from '../format'

const W = 640
const H = 360
const PAD = 28
const VLO = 12
const VHI = 36

function speedColor(ms) {
  const r = Math.min(1, Math.max(0, ((ms ?? 0) * 3.6 - VLO) / (VHI - VLO)))
  return `hsl(20, 100%, ${Math.round(18 + r * 42)}%)`
}

export default function TrackMap({ series, latest }) {
  const [hover, setHover] = useState(null)
  const outline = useRef({ session: null, pts: [], lastTs: -Infinity })

  const model = useMemo(() => {
    const pts = (series || []).filter((p) => p.x != null && p.y != null)
    if (pts.length === 0) return null
    const o = outline.current
    if (o.session !== pts[0].session_id) {
      o.session = pts[0].session_id
      o.pts = []
      o.lastTs = -Infinity
    }
    pts.forEach((p) => {
      if (p.timestamp <= o.lastTs) return
      o.lastTs = p.timestamp
      const lastPt = o.pts[o.pts.length - 1]
      if (!lastPt || Math.hypot(p.x - lastPt[0], p.y - lastPt[1]) > 2) o.pts.push([p.x, p.y])
    })
    if (o.pts.length > 4000) o.pts = o.pts.slice(-4000)
    const xs = o.pts.map((p) => p[0])
    const ys = o.pts.map((p) => p[1])
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const spanX = Math.max(...xs) - minX || 1
    const spanY = Math.max(...ys) - minY || 1
    const s = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
    const ox = (W - s * spanX) / 2
    const oy = (H - s * spanY) / 2
    const tx = (x) => ox + (x - minX) * s
    const ty = (y) => H - (oy + (y - minY) * s)
    const step = Math.max(1, Math.floor(pts.length / 240))
    const placed = pts
      .filter((_, i) => i % step === 0 || i === pts.length - 1)
      .map((p) => ({ ...p, sx: tx(p.x), sy: ty(p.y) }))
    const shape = o.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${tx(x).toFixed(1)},${ty(y).toFixed(1)}`).join(' ')
    return { placed, shape }
  }, [series])

  const head = (
    <header className="panel-head">
      <h2>Pista</h2>
      <span className="panel-tag">
        Volta <b>{has(latest?.lap) ? latest.lap : '--'}</b> · {num(latest?.lap_distance, 0)} m na volta
      </span>
    </header>
  )

  if (!model) {
    return (
      <section className="panel track">
        {head}
        <p className="muted">Sem posição (x, y) na telemetria ainda.</p>
      </section>
    )
  }

  const { placed, shape } = model
  const car = placed[placed.length - 1]
  const prev = placed.length > 1 ? placed[placed.length - 2] : car
  const heading = (Math.atan2(car.sy - prev.sy, car.sx - prev.sx) * 180) / Math.PI
  const hp = hover != null ? placed[hover] : null
  const tipX = hp ? Math.min(hp.sx + 10, W - 156) : 0
  const tipY = hp ? Math.max(hp.sy - 74, 6) : 0

  return (
    <section className="panel track">
      {head}
      <svg viewBox={`0 0 ${W} ${H}`} className="track-svg" role="img" aria-label="Traçado da pista com posição atual">
        <path d={shape} className="track-line" />
        <path d={shape} className="track-center" />
        {placed.map((p, i) => (
          <circle
            key={i}
            cx={p.sx}
            cy={p.sy}
            r={hover === i ? 6 : 3.2}
            fill={speedColor(p.velocity)}
            stroke={hover === i ? '#fff' : 'none'}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <g transform={`translate(${car.sx}, ${car.sy})`}>
          <circle r={12} className="track-car-glow" />
          <polygon points="11,0 -7,-7 -7,7" className="track-car" transform={`rotate(${heading})`} />
        </g>
        <g className="track-hud" transform="translate(14, 22)">
          <text>{num(kmh(car.velocity), 1)} km/h</text>
          <text y="18" className="track-hud-sub">{(car.drive_phase ?? '').toUpperCase()}</text>
        </g>
        {hp && (
          <g className="track-tip" transform={`translate(${tipX}, ${tipY})`}>
            <rect width="146" height="66" rx="4" />
            <text x="8" y="17">v {num(kmh(hp.velocity), 1)} km/h</text>
            <text x="8" y="33">P {num(hp.electrical_power ?? hp.power, 0)} W</text>
            <text x="8" y="49">SoC {num(hp.soc, 1, 100)} %</text>
            <text x="82" y="49">Idc {num(hp.idc, 1)} A</text>
          </g>
        )}
      </svg>
      <div className="track-legend">
        <span>{VLO} km/h</span>
        <i className="track-ramp" />
        <span>{VHI} km/h</span>
        <span className="muted">Rastro recente, cor = velocidade. Passe o mouse num ponto.</span>
      </div>
    </section>
  )
}
