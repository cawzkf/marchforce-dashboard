import { useEffect, useState } from 'react'
import { PHASES, clock, has } from '../format'
import { gpsStatus } from '../gps'

const STALE_MS = 3000

const TABS = [
  ['live', 'Ao vivo'],
  ['history', 'Sessões'],
  ['system', 'Sistema'],
]

export default function StatusBar({ demo, onToggleDemo, connected, latest, elapsed, tab, onTab }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  const ageMs = latest ? now - latest.timestamp * 1000 : null
  const stale = ageMs !== null && ageMs > STALE_MS
  const link = demo ? 'demo' : !connected ? 'off' : stale ? 'stale' : 'live'
  const linkText = { demo: 'DEMO', off: 'OFFLINE', stale: 'SEM DADOS', live: 'AO VIVO' }[link]
  const phase = latest?.drive_phase
  const phaseInfo = PHASES[phase]
  const gps = gpsStatus(latest)

  return (
    <header className="topbar">
      <div className="brand">
        <img src="/logo-mark.png" alt="MachForce" className="brand-logo" />
        <div className="brand-text">
          <span className="brand-name">MachForce</span>
          <span className="brand-sub">Telemetria · Shell Eco-marathon</span>
        </div>
      </div>

      <div className="readouts">
        <div className={`link link-${link}`}>
          <span className="link-dot" aria-hidden="true" />
          <span>{linkText}</span>
        </div>
        <div className="readout">
          <span className="readout-label">Sessão</span>
          <span className="readout-value mono">{latest?.session_id ?? '--'}</span>
        </div>
        <div className="readout">
          <span className="readout-label">Latência</span>
          <span className={`readout-value ${stale ? 'is-stale' : ''}`}>
            {ageMs === null ? '--' : stale ? `${(ageMs / 1000).toFixed(0)} s` : `${Math.max(0, ageMs).toFixed(0)} ms`}
          </span>
        </div>
        <div className="readout">
          <span className="readout-label">Volta</span>
          <span className="readout-value">{has(latest?.lap) ? String(latest.lap).padStart(2, '0') : '--'}</span>
        </div>
        <div className={`readout gps-readout gps-${gps.level}`} title="Satélites e diluição horizontal de precisão (HDOP)">
          <span className="readout-label">GPS</span>
          <span className="readout-value">
            <i aria-hidden="true" />
            {gps.text.replace(/^GPS ?/, '') || '--'}
          </span>
        </div>
        <div className="readout">
          <span className="readout-label">Tempo</span>
          <span className="readout-value">{clock(elapsed)}</span>
        </div>
        <div className={`phase phase-${phaseInfo ? phase : 'none'}`} title={phaseInfo?.hint}>
          <span className="phase-label">{phaseInfo?.label ?? '--'}</span>
          <span className="phase-hint">{phaseInfo?.hint ?? 'Fase'}</span>
        </div>
      </div>

      <nav className="tabs" aria-label="Seções">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => onTab(id)}>{label}</button>
        ))}
        <button className={`demo-toggle ${demo ? 'on' : ''}`} onClick={onToggleDemo} aria-pressed={demo}>
          Demo {demo ? 'ligado' : 'desligado'}
        </button>
      </nav>
    </header>
  )
}
