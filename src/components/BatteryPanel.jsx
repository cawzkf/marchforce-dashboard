import { LEVEL_TEXT, LIMITS, has, levelOf, num } from '../format'

const LO = LIMITS.cellMin
const HI = LIMITS.cellMax

function x(v) {
  return `${((Math.min(HI, Math.max(LO, v)) - LO) / (HI - LO)) * 100}%`
}

export default function BatteryPanel({ latest }) {
  const vmin = latest?.cell_voltage_min
  const vavg = latest?.cell_voltage_avg
  const vmax = latest?.cell_voltage_max
  const ok = has(vmin) && has(vmax)
  const spread = ok ? (vmax - vmin) * 1000 : null
  const level = levelOf(spread, 30, 60)

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Bateria</h2>
        <span className="panel-tag">LiFePO4 16S · 48 V</span>
      </header>

      <div className="cells">
        <div className="cells-head">
          <span className="meter-label">Tensão de célula (mín / méd / máx)</span>
          <span className={`chip lvl-${level}`}>Δ {num(spread, 0)} mV {LEVEL_TEXT[level]}</span>
        </div>
        <div className="cells-scale">
          <div className="cells-zone crit" style={{ left: 0, width: x(2.8) }} />
          <div className="cells-zone warn" style={{ left: x(2.8), width: `calc(${x(3.0)} - ${x(2.8)})` }} />
          <div className="cells-zone warn" style={{ left: x(3.6), right: 0 }} />
          {ok && (
            <div className="cells-range" style={{ left: x(vmin), width: `max(3px, calc(${x(vmax)} - ${x(vmin)}))` }} />
          )}
          {has(vavg) && <div className="cells-avg" style={{ left: x(vavg) }} />}
        </div>
        <div className="cells-axis">
          {[2.5, 2.8, 3.0, 3.2, 3.4, 3.65].map((t) => (
            <span key={t} style={{ left: x(t) }}>{t.toFixed(2)}</span>
          ))}
        </div>
        <div className="cells-values">
          <span>Mín <b>{num(vmin, 3)}</b> V</span>
          <span>Méd <b>{num(vavg, 3)}</b> V</span>
          <span>Máx <b>{num(vmax, 3)}</b> V</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Vdc</span>
          <span className="stat-value">{num(latest?.vdc, 2)}<small>V</small></span>
        </div>
        <div className="stat">
          <span className="stat-label">Idc</span>
          <span className="stat-value">{num(latest?.idc, 2)}<small>A</small></span>
        </div>
        <div className="stat">
          <span className="stat-label">Pico Idc</span>
          <span className="stat-value">{num(latest?.battery_current_peak, 1)}<small>A</small></span>
        </div>
      </div>
      <p className="panel-foot">
        Faixa da célula {LO.toFixed(2)} a {HI.toFixed(2)} V · média × 16 = <b>{has(vavg) ? (vavg * LIMITS.cells).toFixed(1) : '--'} V</b>
      </p>
    </section>
  )
}
