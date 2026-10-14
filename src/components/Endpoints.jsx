import { useEffect, useState } from 'react'

export default function Endpoints() {
  const [ep, setEp] = useState(null)

  useEffect(() => {
    fetch('/api/endpoints').then((r) => r.json()).then(setEp).catch(() => setEp({}))
  }, [])

  if (!ep) return null
  const host = ep.host || window.location.hostname

  const items = [
    ['Gêmeo digital (AAS Tipo 2, OPC UA)', `opc.tcp://${host}:${ep.opcua_port ?? 4840}`],
    ['MQTT', `${host}:${ep.mqtt_port ?? 1883}`],
    ['API REST', `http://${host}:${ep.api_port ?? 8000}`],
  ]

  return (
    <section className="endpoints">
      <span className="endpoints-title">Endpoints</span>
      {items.map(([label, value]) => (
        <div className="endpoint" key={label}>
          <span className="endpoint-label">{label}</span>
          <code className="endpoint-value">{value}</code>
        </div>
      ))}
    </section>
  )
}
