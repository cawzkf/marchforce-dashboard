import { useMemo } from 'react'
import { LEVEL_TEXT, THERMAL, has, levelOf, num } from '../format'

const TMIN = 20
const H = 150
const TOP = 6

function Spark({ values }) {
  const pts = values.filter(has)
  if (pts.length < 2) return <svg className="spark" viewBox="0 0 80 22" />
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const span = hi - lo || 1
  const d = pts
    .map((v, i) => `${((i / (pts.length - 1)) * 80).toFixed(1)},${(20 - ((v - lo) / span) * 18).toFixed(1)}`)
    .join(' ')
  const delta = pts[pts.length - 1] - pts[0]
  return (
    <svg className="spark" viewBox="0 0 80 22" aria-label={`Tendência ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} °C`}>
      <polyline points={d} />
    </svg>
  )
}

function Thermo({ k, value, history }) {
  const cfg = THERMAL[k]
  const y = (t) => TOP + H - ((Math.min(cfg.max, Math.max(TMIN, t)) - TMIN) / (cfg.max - TMIN)) * H
  const level = levelOf(value, cfg.warn, cfg.crit)
  const delta = history.length > 1 && has(value) && has(history[0]) ? value - history[0] : null

  return (
    <div className={`thermo lvl-${level}`}>
      <span className="thermo-label">{cfg.label}</span>
      <svg viewBox="0 0 64 166" className="thermo-svg" role="img"
           aria-label={`${cfg.label} ${num(value, 1)} °C ${LEVEL_TEXT[level]}`}>
        <rect x="18" y={TOP} width="16" height={H} rx="3" className="thermo-tube" />
        {cfg.warn !== undefined && (
          <>
            <rect x="38" y={y(cfg.crit)} width="5" height={y(cfg.warn) - y(cfg.crit)} className="thermo-band-warn" />
            <rect x="38" y={y(cfg.max)} width="5" height={y(cfg.crit) - y(cfg.max)} className="thermo-band-crit" />
            <text x="46" y={y(cfg.warn) + 3} className="thermo-scale">{cfg.warn}</text>
            <text x="46" y={y(cfg.crit) + 3} className="thermo-scale">{cfg.crit}</text>
          </>
        )}
        <text x="46" y={y(cfg.max) + 7} className="thermo-scale dim">{cfg.max}</text>
        <text x="46" y={TOP + H} className="thermo-scale dim">{TMIN}</text>
        {has(value) && (
          <rect x="20" y={y(value)} width="12" height={TOP + H - y(value)} rx="2" className="thermo-fill" />
        )}
      </svg>
      <span className="thermo-value">{num(value, 1)}<small>°C</small></span>
      <span className="thermo-state">{LEVEL_TEXT[level] || 'REF'}</span>
      <Spark values={history} />
      <span className="thermo-delta">
        {delta === null ? '--' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} °C`}
      </span>
    </div>
  )
}

export default function ThermalPanel({ latest, series }) {
  const hist = useMemo(() => {
    const step = Math.max(1, Math.floor(series.length / 60))
    const pick = series.filter((_, i) => i % step === 0)
    return Object.fromEntries(Object.keys(THERMAL).map((k) => [k, pick.map((p) => p[k])]))
  }, [series])

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Térmico</h2>
        <span className="panel-tag">°C · faixa alerta / crítico</span>
      </header>
      <div className="thermo-row">
        {Object.keys(THERMAL).map((k) => (
          <Thermo key={k} k={k} value={latest?.[k]} history={hist[k]} />
        ))}
      </div>
    </section>
  )
}
