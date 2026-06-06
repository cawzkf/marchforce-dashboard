import { useEffect, useState } from 'react'
import ConfigModal from './ConfigModal'

export default function Parameters() {
  const [cfg, setCfg] = useState(null)
  const [editing, setEditing] = useState(false)

  const load = () =>
    fetch('/api/config').then((r) => r.json()).then(setCfg).catch(() => {})

  useEffect(() => { load() }, [])

  if (!cfg) return null
  const v = cfg.vehicle
  const a = cfg.alerts

  const vehicle = [
    ['Peso do veículo', v.mass_vehicle, 'kg'],
    ['Peso do motorista', v.mass_driver, 'kg'],
    ['Peso total', v.total_mass, 'kg'],
    ['Coef. de arrasto', v.drag_coefficient, ''],
    ['Área frontal', v.frontal_area, 'm²'],
    ['Resist. rolamento', v.rolling_resistance, ''],
    ['Tensão nominal DC', v.nominal_dc_voltage, 'V'],
    ['Bateria', (v.battery_capacity_j / 3.6e6).toFixed(2), 'kWh'],
  ]
  const alerts = [
    ['SoC alerta / crítico', `${(a.soc_warning * 100).toFixed(0)} / ${(a.soc_critical * 100).toFixed(0)}`, '%'],
    ['Idc alerta / crítico', `${a.idc_warning} / ${a.idc_critical}`, 'A'],
    ['Velocidade alerta / crítico', `${a.speed_warning} / ${a.speed_critical}`, 'm/s'],
  ]

  return (
    <section className="params">
      <div className="params-block">
        <div className="params-head">
          <h3>Parâmetros do veículo</h3>
          <button className="edit-btn" onClick={() => setEditing(true)}>Editar</button>
        </div>
        <div className="params-grid">
          {vehicle.map(([label, val, unit]) => (
            <div className="param" key={label}>
              <span className="param-label">{label}</span>
              <span className="param-value">{val} <small>{unit}</small></span>
            </div>
          ))}
        </div>
      </div>
      <div className="params-block">
        <h3>Limiares de alerta</h3>
        <div className="params-grid">
          {alerts.map(([label, val, unit]) => (
            <div className="param" key={label}>
              <span className="param-label">{label}</span>
              <span className="param-value">{val} <small>{unit}</small></span>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <ConfigModal config={cfg} onClose={() => setEditing(false)} onSaved={load} />
      )}
    </section>
  )
}
