import { LIMITS, has, num } from '../format'

function pct(v, max) {
  return has(v) ? `${Math.min(100, Math.max(0, (v / max) * 100))}%` : '0%'
}

function Meter({ label, value, display, unit, max, mark, markLabel, cls = '' }) {
  return (
    <div className="meter">
      <div className="meter-head">
        <span className="meter-label">{label}</span>
        <span className="meter-value">{display} <small>{unit}</small></span>
      </div>
      <div className="meter-track">
        <div className={`meter-fill ${cls}`} style={{ width: pct(value, max) }} />
        {mark !== undefined && (
          <div className="meter-mark" style={{ left: pct(mark, max) }}>
            <span>{markLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PowertrainPanel({ latest }) {
  const rpm = latest?.motor_rpm
  const pElec = latest?.electrical_power
  const pMech = latest?.power
  const loss = has(pElec) && has(pMech) ? Math.max(0, pElec - pMech) : null
  const eff = latest?.drive_phase === 'burn' ? latest?.motor_efficiency : null

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Trem de força</h2>
        <span className="panel-tag">Maxon EC-i 52 · {LIMITS.gearRatio}:1</span>
      </header>

      <Meter
        label="Rotação do motor" value={rpm} display={num(rpm, 0)} unit="rpm"
        max={LIMITS.motorMaxRpm} mark={LIMITS.motorNominalRpm} markLabel="NOM" cls="fill-accent"
      />

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Torque</span>
          <span className="stat-value">{num(latest?.motor_torque, 2)}<small>N·m</small></span>
        </div>
        <div className="stat">
          <span className="stat-label">Eficiência</span>
          <span className="stat-value">{num(eff, 1, 100)}<small>%</small></span>
        </div>
        <div className="stat">
          <span className="stat-label">Roda</span>
          <span className="stat-value">{has(rpm) ? (rpm / LIMITS.gearRatio).toFixed(0) : '--'}<small>rpm</small></span>
        </div>
      </div>

      <Meter
        label="Potência elétrica" value={pElec} display={num(pElec, 0)} unit="W"
        max={LIMITS.powerMax} mark={LIMITS.motorNominalW} markLabel="200 W" cls="fill-accent"
      />
      <Meter
        label="Potência mecânica" value={pMech} display={num(pMech, 0)} unit="W"
        max={LIMITS.powerMax} mark={LIMITS.motorNominalW} markLabel="200 W" cls="fill-light"
      />
      <p className="panel-foot">
        Perdas (elétrica menos mecânica): <b>{num(loss, 0)} W</b>
      </p>
    </section>
  )
}
