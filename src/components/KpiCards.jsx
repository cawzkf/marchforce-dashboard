import { num } from '../format'

const CARDS = [
  { key: 'distance', label: 'Distância', unit: 'km', scale: 1 / 1000, digits: 3 },
  { key: 'lap_distance', label: 'Na volta', unit: 'm', digits: 0 },
  { key: 'energy', label: 'Energia mecânica', unit: 'kJ', scale: 1 / 1000, digits: 2 },
  { key: 'avg_power', label: 'Potência média', unit: 'W', digits: 0 },
  { key: 'specific_consumption', label: 'Consumo específico', unit: 'Wh/km', scale: 1000, digits: 2 },
  { key: 'autonomy', label: 'Autonomia', unit: 'min', scale: 1 / 60, digits: 0 },
  { key: 'acceleration', label: 'Aceleração', unit: 'm/s²', digits: 2 },
  { key: 'vdc', label: 'Tensão DC', unit: 'V', digits: 2 },
]

export default function KpiCards({ latest }) {
  return (
    <section className="kpis" aria-label="Indicadores">
      {CARDS.map((c) => (
        <div className="kpi" key={c.key}>
          <span className="kpi-label">{c.label}</span>
          <span className="kpi-value">
            {num(latest?.[c.key], c.digits ?? 2, c.scale ?? 1)}
            <small>{c.unit}</small>
          </span>
        </div>
      ))}
    </section>
  )
}
