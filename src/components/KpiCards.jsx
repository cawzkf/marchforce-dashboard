function fmt(v, digits = 2) {
  return v === null || v === undefined ? '—' : Number(v).toFixed(digits)
}

const CARDS = [
  { key: 'velocity', label: 'Velocidade', unit: 'm/s' },
  { key: 'power', label: 'Potência (Pdc)', unit: 'W' },
  { key: 'vdc', label: 'Tensão DC', unit: 'V' },
  { key: 'idc', label: 'Corrente DC', unit: 'A' },
  { key: 'soc', label: 'SoC', unit: '%', scale: 100, digits: 1 },
  { key: 'energy', label: 'Energia acumulada', unit: 'J', digits: 0 },
  { key: 'distance', label: 'Distância', unit: 'm', digits: 1 },
  { key: 'specific_consumption', label: 'Consumo específico', unit: 'Wh/m', digits: 4 },
  { key: 'autonomy', label: 'Autonomia estimada', unit: 's', digits: 0 },
]

export default function KpiCards({ latest }) {
  return (
    <section className="kpis">
      {CARDS.map((c) => {
        const raw = latest?.[c.key]
        const value = raw !== undefined && raw !== null ? raw * (c.scale ?? 1) : null
        return (
          <div className="kpi" key={c.key}>
            <span className="kpi-label">{c.label}</span>
            <span className="kpi-value">{fmt(value, c.digits ?? 2)}</span>
            <span className="kpi-unit">{c.unit}</span>
          </div>
        )
      })}
    </section>
  )
}
