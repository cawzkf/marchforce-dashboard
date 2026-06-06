import { useMemo, useState } from 'react'

const W = 640
const H = 380
const PAD = 30

function speedColor(v, vmax) {
  const r = vmax ? Math.min(1, v / vmax) : 0
  return `hsl(28, ${Math.round(r * 95)}%, ${Math.round(45 + r * 10)}%)`
}

export default function TrackMap({ series }) {
  const [hover, setHover] = useState(null)

  const model = useMemo(() => {
    const pts = (series || []).filter((p) => p.x != null && p.y != null)
    if (pts.length === 0) return null
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const spanX = Math.max(...xs) - minX || 1
    const spanY = Math.max(...ys) - minY || 1
    const s = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
    const ox = (W - s * spanX) / 2
    const oy = (H - s * spanY) / 2
    const vmax = Math.max(...pts.map((p) => p.velocity ?? 0), 0.001)
    const placed = pts.map((p) => ({
      ...p,
      sx: ox + (p.x - minX) * s,
      sy: H - (oy + (p.y - minY) * s),
    }))
    return { placed, vmax }
  }, [series])

  if (!model) {
    return (
      <section className="track">
        <h3>Pista</h3>
        <p className="muted">Sem posição (x, y) na telemetria ainda.</p>
      </section>
    )
  }

  const { placed, vmax } = model
  const path = placed.map((p, i) => `${i ? 'L' : 'M'}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`).join(' ')
  const car = placed[placed.length - 1]
  const prev = placed.length > 1 ? placed[placed.length - 2] : car
  const heading = (Math.atan2(car.sy - prev.sy, car.sx - prev.sx) * 180) / Math.PI
  const hp = hover != null ? placed[hover] : null
  const tipX = hp ? Math.min(hp.sx + 10, W - 150) : 0
  const tipY = hp ? Math.max(hp.sy - 70, 6) : 0

  return (
    <section className="track">
      <h3>Pista — telemetria por ponto</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="track-svg">
        <path d={path} className="track-line" />
        {placed.map((p, i) => (
          <circle
            key={i}
            cx={p.sx}
            cy={p.sy}
            r={hover === i ? 5.5 : 3}
            fill={speedColor(p.velocity ?? 0, vmax)}
            stroke={hover === i ? '#fff' : 'none'}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <g transform={`translate(${car.sx}, ${car.sy})`}>
          <circle r={9} className="track-car-glow" />
          <polygon points="11,0 -7,-7 -7,7" className="track-car"
                   transform={`rotate(${heading})`} />
          <text x={14} y={-10} className="track-hud">
            {Number(car.velocity).toFixed(1)} m/s
          </text>
        </g>
        {hp && (
          <g className="track-tip" transform={`translate(${tipX}, ${tipY})`}>
            <rect width="140" height="64" rx="6" />
            <text x="8" y="16">v: {Number(hp.velocity).toFixed(1)} m/s</text>
            <text x="8" y="31">P: {Number(hp.power).toFixed(0)} W</text>
            <text x="8" y="46">SoC: {(hp.soc * 100).toFixed(1)}%</text>
            <text x="76" y="46">Idc: {Number(hp.idc).toFixed(0)} A</text>
          </g>
        )}
      </svg>
      <p className="muted">Cor = velocidade (verde→vermelho). Passe o mouse num ponto pra ver a telemetria.</p>
    </section>
  )
}
