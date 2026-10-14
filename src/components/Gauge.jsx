import { has } from '../format'

const CX = 120
const CY = 122
const R = 82
const START = 135
const SWEEP = 270

function polar(angle, r) {
  const a = (angle * Math.PI) / 180
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)]
}

function arc(a0, a1, r) {
  const [x0, y0] = polar(a0, r)
  const [x1, y1] = polar(a1, r)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`
}

export default function Gauge({
  value, min = 0, max, label, unit, display, sub, ticks = [], bands = [], marks = [], level = 'none',
}) {
  const ang = (v) => START + (Math.min(max, Math.max(min, v)) - min) / (max - min) * SWEEP
  const valueAngle = has(value) ? ang(value) : START

  return (
    <div className={`gauge lvl-${level}`}>
      <span className="gauge-title">{label}</span>
      <svg viewBox="0 0 240 206" role="img" aria-label={`${label}: ${display} ${unit}`}>
        <path d={arc(START, START + SWEEP, R)} className="gauge-track" />
        {bands.map((b) => (
          <path key={b.from} d={arc(ang(b.from), ang(b.to), R + 12)} className={`gauge-band ${b.cls}`} />
        ))}
        {has(value) && valueAngle > START + 0.5 && (
          <path d={arc(START, valueAngle, R)} className="gauge-value" />
        )}
        {ticks.map((t) => {
          const [x0, y0] = polar(ang(t), R - 10)
          const [x1, y1] = polar(ang(t), R - 18)
          const [tx, ty] = polar(ang(t), R + 25)
          return (
            <g key={t}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} className="gauge-tick" />
              {!marks.some((m) => m.at === t) && <text x={tx} y={ty} className="gauge-tick-label">{t}</text>}
            </g>
          )
        })}
        {marks.map((m) => {
          const [x0, y0] = polar(ang(m.at), R - 8)
          const [x1, y1] = polar(ang(m.at), R + 16)
          const [tx, ty] = polar(ang(m.at), R + 27)
          return (
            <g key={m.at}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} className="gauge-mark" />
              <text x={tx} y={ty} className="gauge-mark-label">{m.label}</text>
            </g>
          )
        })}
        {has(value) && (() => {
          const [nx, ny] = polar(valueAngle, R + 6)
          const [bx, by] = polar(valueAngle, R - 8)
          return <line x1={bx} y1={by} x2={nx} y2={ny} className="gauge-needle" />
        })()}
        <text x={CX} y={CY + 6} className="gauge-number">{display}</text>
        <text x={CX} y={CY + 30} className="gauge-unit">{unit}</text>
      </svg>
      {sub && <div className="gauge-sub">{sub}</div>}
    </div>
  )
}
