export default function AlertsPanel({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <section className="alerts">
        <div className="alert ok">
          <span className="alert-code">OK</span>
          <span>Sistema operando normalmente</span>
        </div>
      </section>
    )
  }

  return (
    <section className="alerts">
      {alerts.map((a, i) => (
        <div className={`alert ${a.severity}`} key={`${a.code}-${i}`}>
          <span className="alert-code">{a.code}</span>
          <span>{a.message}</span>
          {a.value !== null && a.value !== undefined && (
            <span className="alert-value">{a.value}</span>
          )}
        </div>
      ))}
    </section>
  )
}
