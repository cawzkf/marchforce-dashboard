import Gauge from './Gauge'
import { LIMITS, has, kmh, num } from '../format'

function socLevel(soc) {
  if (!has(soc)) return 'none'
  if (soc < 0.05) return 'crit'
  if (soc < 0.2) return 'warn'
  return 'ok'
}

export default function HeroRow({ latest }) {
  const speed = kmh(latest?.velocity)
  const soc = latest?.soc
  const pElec = has(latest?.electrical_power) ? latest.electrical_power : null
  const pShown = pElec ?? latest?.power
  const distKm = has(latest?.distance) ? latest.distance / 1000 : null
  const whPerKm = has(latest?.energy_wh) && distKm > 0.01 ? latest.energy_wh / distKm : null
  const kmkwh = latest?.km_per_kwh
  const overPower = has(pShown) && pShown > LIMITS.motorNominalW

  return (
    <section className="hero">
      <div className="panel hero-cell">
        <Gauge
          label="Velocidade" unit="km/h" value={speed} max={LIMITS.speedMax}
          display={num(speed, 1)} ticks={[0, 10, 20, 30, 40]}
          bands={[
            { from: LIMITS.coast[0], to: LIMITS.coast[1], cls: 'band-coast' },
            { from: LIMITS.burn[0], to: LIMITS.burn[1], cls: 'band-burn' },
          ]}
          sub={(
            <>
              <span><i className="key key-burn" />Burn {LIMITS.burn.join('-')}</span>
              <span><i className="key key-coast" />Coast {LIMITS.coast.join('-')}</span>
              <span>a <b>{num(latest?.acceleration, 2)}</b> m/s²</span>
            </>
          )}
        />
      </div>

      <div className="panel hero-cell">
        <Gauge
          label="Estado de carga" unit="% SoC" value={has(soc) ? soc * 100 : null} max={100}
          display={num(soc, 1, 100)} ticks={[0, 25, 50, 75, 100]} level={socLevel(soc)}
          bands={[
            { from: 0, to: 5, cls: 'band-crit' },
            { from: 5, to: 20, cls: 'band-warn' },
          ]}
          sub={(
            <>
              <span>Consumido <b>{num(latest?.energy_wh, 1)}</b> Wh</span>
              <span>Autonomia <b>{num(latest?.autonomy, 0, 1 / 60)}</b> min</span>
            </>
          )}
        />
      </div>

      <div className="panel hero-cell">
        <Gauge
          label={pElec !== null ? 'Potência elétrica' : 'Potência mecânica'} unit="W" value={pShown}
          max={LIMITS.powerMax} display={num(pShown, 0)} ticks={[0, 100, 200, 300, 400]}
          level={overPower ? 'warn' : 'none'}
          bands={[{ from: LIMITS.motorNominalW, to: LIMITS.powerMax, cls: 'band-over' }]}
          marks={[{ at: LIMITS.motorNominalW, label: 'NOM 200' }]}
          sub={(
            <>
              <span>Mecânica <b>{num(latest?.power, 0)}</b> W</span>
              <span>Média <b>{num(latest?.avg_power, 0)}</b> W</span>
            </>
          )}
        />
      </div>

      <div className="panel hero-cell kpi-hero">
        <span className="kpi-hero-label">Eficiência energética</span>
        <span className="kpi-hero-value">{num(kmkwh, 0)}</span>
        <span className="kpi-hero-unit">km/kWh</span>
        <dl className="kpi-hero-grid">
          <div><dt>Consumo</dt><dd>{num(whPerKm, 2)} <small>Wh/km</small></dd></div>
          <div><dt>Distância</dt><dd>{num(distKm, 2)} <small>km</small></dd></div>
          <div><dt>Energia</dt><dd>{num(latest?.energy_wh, 1)} <small>Wh</small></dd></div>
          <div><dt>Volta</dt><dd>{has(latest?.lap) ? latest.lap : '--'}</dd></div>
        </dl>
        <span className="kpi-hero-foot">Métrica oficial Shell Eco-marathon (bateria elétrica)</span>
      </div>
    </section>
  )
}
