import { useEffect, useState } from 'react'

const STALE_MS = 3000

export default function StatusBar({ connected, latest }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const lastTs = latest ? latest.timestamp * 1000 : null
  const ageMs = lastTs ? now - lastTs : null
  const stale = ageMs !== null && ageMs > STALE_MS

  return (
    <div className="statusbar">
      <span className={`dot ${connected ? 'ok' : 'off'}`} />
      <span>{connected ? 'Conectado' : 'Desconectado'}</span>
      <span className="sep">·</span>
      <span>Sessão: <strong>{latest?.session_id ?? '—'}</strong></span>
      <span className="sep">·</span>
      <span className={stale ? 'stale' : ''}>
        {ageMs === null
          ? 'Aguardando dados…'
          : stale
            ? `Sem dados há ${(ageMs / 1000).toFixed(0)}s`
            : 'Recebendo telemetria'}
      </span>
    </div>
  )
}
