import { useEffect, useRef, useState } from 'react'

const SEV = {
  error: { icon: '■', text: 'FALHA' },
  warning: { icon: '▲', text: 'ALERTA' },
  info: { icon: '●', text: 'INFO' },
}

function hhmmss(ts) {
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour12: false })
}

function Message({ a, time }) {
  const sev = SEV[a.severity] ?? SEV.info
  return (
    <li className={`rc-msg sev-${a.severity}`}>
      <span className="rc-sev" aria-label={sev.text}>{sev.icon} {sev.text}</span>
      <span className="rc-time">{time}</span>
      <span className="rc-code">{a.code}</span>
      <span className="rc-text">{a.message}</span>
      {a.value !== null && a.value !== undefined && <span className="rc-value">{a.value}</span>}
    </li>
  )
}

export default function AlertsPanel({ alerts, timestamp, sessionId }) {
  const [log, setLog] = useState([])
  const active = useRef(new Set())

  useEffect(() => {
    setLog([])
    active.current = new Set()
  }, [sessionId])

  useEffect(() => {
    const codes = new Set((alerts ?? []).map((a) => a.code))
    const fresh = (alerts ?? []).filter((a) => !active.current.has(a.code))
    active.current = codes
    if (fresh.length && timestamp) {
      setLog((prev) => [...fresh.map((a) => ({ ...a, ts: timestamp })), ...prev].slice(0, 12))
    }
  }, [alerts, timestamp])

  const list = alerts ?? []

  return (
    <section className="panel race-control">
      <header className="panel-head">
        <h2>Race control</h2>
        <span className={`chip ${list.some((a) => a.severity === 'error') ? 'lvl-crit' : list.some((a) => a.severity === 'warning') ? 'lvl-warn' : 'lvl-ok'}`}>
          {list.filter((a) => a.severity !== 'info').length} ativos
        </span>
      </header>
      <ul className="rc-list">
        {list.length === 0 ? (
          <li className="rc-msg sev-ok">
            <span className="rc-sev">● OK</span>
            <span className="rc-time">{timestamp ? hhmmss(timestamp) : '--'}</span>
            <span className="rc-code">OK</span>
            <span className="rc-text">Sistema operando normalmente</span>
          </li>
        ) : (
          list.map((a) => <Message key={a.code} a={a} time={timestamp ? hhmmss(timestamp) : '--'} />)
        )}
      </ul>
      <h3 className="rc-log-title">Histórico da sessão</h3>
      <ul className="rc-list rc-log">
        {log.length === 0 && <li className="muted">Nenhuma mensagem registrada.</li>}
        {log.map((a, i) => <Message key={`${a.code}-${a.ts}-${i}`} a={a} time={hhmmss(a.ts)} />)}
      </ul>
    </section>
  )
}
