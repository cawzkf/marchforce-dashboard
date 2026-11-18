import { useEffect, useRef, useState } from 'react'
import { LIMITS, PACK } from '../data/catalog'
import { br, describe, has, levelOf, rankedAlerts, signalValue } from '../lib/telemetry'

export function useSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return undefined
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, size]
}

export function Fit({ w, h, children }) {
  const [ref, size] = useSize()
  const scale = size.width ? Math.min(size.width / w, size.height / h) : 0
  return (
    <div className="fit" ref={ref}>
      <div className="fit-box" style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})` }}>{children}</div>
    </div>
  )
}

export function Panel({ title, note, actions, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {actions ?? (note && <span className="muted small">{note}</span>)}
      </header>
      {children}
    </section>
  )
}

export function Stat({ label, value, unit }) {
  return (
    <div className="stat">
      <span className="muted small">{label}</span>
      <strong>{value}{unit && <small> {unit}</small>}</strong>
    </div>
  )
}

export function SimTag({ bench }) {
  return <span className={`sim-tag ${bench ? 'bench' : ''}`}><i />{bench ? 'MEDIDO NA BANCADA' : 'DADOS SIMULADOS'}</span>
}

export function Chart({ height, x, y, lines = [], grids = [], bands = [], vlines = [], dots = [], xLabels = [], left = 58, label }) {
  const [ref, { width }] = useSize()
  const top = 10
  const bottom = 22
  const plotW = Math.max(width - left - 12, 1)
  const plotH = height - top - bottom
  const sx = (v) => left + ((v - x[0]) / (x[1] - x[0] || 1)) * plotW
  const sy = (v) => top + plotH - ((v - y[0]) / (y[1] - y[0] || 1)) * plotH
  const clampX = (v) => Math.min(left + plotW, Math.max(left, sx(v)))
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label}>
          {bands.map(([a, b]) => <rect key={`${a}`} className="band" x={clampX(a)} y={top} width={Math.max(0, clampX(b) - clampX(a))} height={plotH} />)}
          {grids.map(([v, text, tone]) => (
            <g key={text}>
              <line className={`grid ${tone ?? ''}`} x1={left} x2={left + plotW} y1={sy(v)} y2={sy(v)} />
              <text className="axis" x={6} y={sy(v) + 4}>{text}</text>
            </g>
          ))}
          {vlines.map(([v, text, tone]) => (
            <g key={`${v}-${text}`}>
              <line className={`mark ${tone ?? ''}`} x1={sx(v)} x2={sx(v)} y1={top} y2={top + plotH} />
              {text && <text className={`axis ${tone ?? ''}`} x={Math.min(sx(v) + 5, left + plotW - 70)} y={top + 13}>{text}</text>}
            </g>
          ))}
          {lines.map((l) => ({ ...l, points: l.points.filter(([a, b]) => has(a) && has(b)) })).filter((l) => l.points.length > 1).map((l) => (
            <polyline key={l.name} className={`line ${l.tone ?? ''} ${l.dash ? 'dash' : ''}`}
              points={l.points.map(([a, b]) => `${clampX(a).toFixed(1)},${sy(b).toFixed(1)}`).join(' ')} />
          ))}
          {dots.filter(([a, b]) => has(a) && has(b)).map(([a, b, tone]) => <circle key={`${a}`} className={`dot ${tone ?? ''}`} cx={clampX(a)} cy={sy(b)} r={6} />)}
          {xLabels.map(([v, text]) => <text key={text} className="axis" x={Math.min(sx(v), left + plotW - 48)} y={height - 6}>{text}</text>)}
        </svg>
      )}
    </div>
  )
}

export function burnBands(series) {
  const bands = []
  let start = null
  series.forEach((p, i) => {
    const burn = p.drive_phase === 'burn'
    if (burn && start === null) start = p.timestamp
    if (start !== null && (!burn || i === series.length - 1)) {
      bands.push([start, p.timestamp])
      start = null
    }
  })
  return bands
}

function status(label, state, detail, alert) {
  return { label, state, detail, alert }
}

function tempStatus(label, key, sample, normal) {
  const value = signalValue(sample, key)
  if (!has(value)) return status(label, 'Indisponível', 'Sem medição', false)
  const level = levelOf(key, value)
  const text = `${br(value)} ${LIMITS[key].unit}`
  if (level === 'crit') return status(label, 'Falha', `${text}, acima de ${LIMITS[key].crit}`, true)
  if (level === 'warn') return status(label, 'Alerta', `${text}, acima de ${LIMITS[key].warn}`, true)
  return status(label, normal, text, false)
}

export function HealthStrip({ t }) {
  const s = t.latest
  if (!s) return <div className="health"><div className="health-cell"><span className="muted">Aguardando amostras</span></div></div>
  const dcLevel = [levelOf('vdc', s.vdc), levelOf('idc', Math.abs(s.idc))]
  const dcAlert = dcLevel.includes('warn') || dcLevel.includes('crit')
  const residual = has(s.motor_temp_model) && has(s.motor_temp) ? s.motor_temp - s.motor_temp_model : null
  const diverged = has(residual) && Math.abs(residual) > 10
  const items = [
    status('Bateria', tempStatus('', 'battery_temp', s, 'Normal').state, has(s.battery_temp) ? `Célula mín ${br(s.cell_voltage_min, 3)} V · ${br(s.battery_temp)} °C` : 'Sem medição', tempStatus('', 'battery_temp', s).alert),
    tempStatus('Inversor', 'controller_temp', s, 'Normal'),
    tempStatus('Motor', 'motor_temp', s, 'Normal'),
    status('Barramento DC', dcAlert ? 'Alerta' : 'Normal', `${br(s.vdc)} V · ${br(s.idc, 2)} A`, dcAlert),
    status('Telemetria', t.stale ? 'Sem dados' : 'Ativa', t.stale ? `Última amostra há ${br(t.age, 0)} s` : `Última amostra há ${br(t.age, 1)} s${has(s.bus_age_ms) ? ` · RS485 ${br(s.bus_age_ms, 0)} ms` : ''}`, t.stale),
    status('Gêmeo digital', !has(residual) ? 'Indisponível' : diverged ? 'Divergente' : 'Coerente', has(residual) ? `Motor ${residual >= 0 ? '+' : ''}${br(residual)} K do modelo` : 'Modelo indisponível', diverged),
  ]
  return (
    <div className="health">
      {items.map((i) => (
        <div key={i.label} className={`health-cell ${i.alert ? 'alert' : ''}`}>
          <div><span>{i.label}</span><strong>{i.state}</strong></div>
          <small>{i.detail}</small>
        </div>
      ))}
    </div>
  )
}

export function Bar({ value, max, marks = [] }) {
  const pct = (v) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`
  return (
    <div className="bar">
      <i style={{ width: pct(value) }} />
      {marks.map(([v, tone]) => <b key={v} className={tone} style={{ left: pct(v) }} />)}
    </div>
  )
}

export const cellSpread = (s) => (has(s?.cell_voltage_max) ? (s.cell_voltage_max - s.cell_voltage_min) * 1000 : null)
export const cellPct = (v) => `${((v - PACK.cellMin) / (PACK.cellMax - PACK.cellMin)) * 100}%`
export const topAlert = (s) => {
  const alert = rankedAlerts(s)[0] ?? null
  return alert ? { alert, info: describe(alert) } : null
}
