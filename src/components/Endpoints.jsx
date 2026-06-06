import { useEffect, useState } from 'react'

export default function Endpoints() {
  const [ep, setEp] = useState(null)

  useEffect(() => {
    fetch('/api/endpoints').then((r) => r.json()).then(setEp).catch(() => setEp({}))
  }, [])

  if (!ep) return null
  const host = ep.host || window.location.hostname

  const items = [
    ['OPC UA', `opc.tcp://${host}:${ep.opcua_port ?? 4840}`],
    ['MQTT', `${host}:${ep.mqtt_port ?? 1883}`],
    ['BaSyx AAS', `http://${host}:${ep.basyx_port ?? 8081}`],
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
