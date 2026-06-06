import { useState } from 'react'

const VEHICLE_FIELDS = [
  ['mass_vehicle', 'Peso do veículo (kg)'],
  ['mass_driver', 'Peso do motorista (kg)'],
  ['drag_coefficient', 'Coef. de arrasto'],
  ['frontal_area', 'Área frontal (m²)'],
  ['rolling_resistance', 'Resist. ao rolamento'],
  ['nominal_dc_voltage', 'Tensão nominal DC (V)'],
  ['battery_capacity_j', 'Bateria (J)'],
]

const ALERT_FIELDS = [
  ['soc_warning', 'SoC alerta (0–1)'],
  ['soc_critical', 'SoC crítico (0–1)'],
  ['idc_warning', 'Idc alerta (A)'],
  ['idc_critical', 'Idc crítico (A)'],
  ['speed_warning', 'Velocidade alerta (m/s)'],
  ['speed_critical', 'Velocidade crítico (m/s)'],
]

export default function ConfigModal({ config, onClose, onSaved }) {
  const [vehicle, setVehicle] = useState({ ...config.vehicle })
  const [alerts, setAlerts] = useState({ ...config.alerts })
  const [saving, setSaving] = useState(false)

  const onNum = (setter, key) => (e) =>
    setter((s) => ({ ...s, [key]: parseFloat(e.target.value) }))

  async function save() {
    setSaving(true)
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle, alerts }),
      })
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar configuração</h2>

        <h3>Parâmetros do veículo</h3>
        <div className="modal-grid">
          {VEHICLE_FIELDS.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input type="number" step="any" value={vehicle[key] ?? ''} onChange={onNum(setVehicle, key)} />
            </label>
          ))}
        </div>

        <h3>Ranges de alerta</h3>
        <div className="modal-grid">
          {ALERT_FIELDS.map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input type="number" step="any" value={alerts[key] ?? ''} onChange={onNum(setAlerts, key)} />
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={save} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
