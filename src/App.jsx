import { useCallback, useEffect, useState } from 'react'
import Diagnostico from './screens/Diagnostico'
import { Displays, FullDisplay } from './screens/Displays'
import Operacao from './screens/Operacao'
import { Alertas, Eficiencia, Sinais } from './screens/Reference'
import { useTelemetry } from './telemetry/useTelemetry'
import { br, faultInfo } from './lib/telemetry'
import { SimTag } from './ui/kit'

const NAV = [
  ['/operacao', 'Operação'], ['/diagnostico', 'Diagnóstico'], ['/sinais', 'Sinais'],
  ['/eficiencia', 'Casos de eficiência'], ['/alertas', 'Casos de alerta'], ['/displays', 'Displays'],
]
const FULL = { '/piloto': 'piloto', '/mecanica': 'mecanica', '/box': 'box' }

function useRoute() {
  const [location, setLocation] = useState({ path: window.location.pathname, search: window.location.search })
  useEffect(() => {
    const sync = () => setLocation({ path: window.location.pathname, search: window.location.search })
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  const go = useCallback((path, search = window.location.search) => {
    window.history.pushState(null, '', `${path}${search}`)
    setLocation({ path, search })
    window.scrollTo(0, 0)
  }, [])
  return { ...location, go }
}

function FaultBar({ t, onSimulator }) {
  const { fault, faults } = t
  const current = faultInfo(fault.active)
  if (t.bench) {
    const lost = !t.benchState.online || t.stale
    return (
      <div className={`fault-bar ${lost ? 'active' : ''}`}>
        <strong>{lost ? 'SINAL DA BANCADA PERDIDO' : 'Bancada'}</strong>
        <span>{lost ? `Último heartbeat há ${br(t.benchState.age_s, 0)} s` : `${t.benchState.device ?? 'Nó de bancada'} · falha ao vivo só existe no simulador`}</span>
        <div className="fault-buttons"><button type="button" className="normalize" onClick={onSimulator}>Voltar ao simulador</button></div>
      </div>
    )
  }
  return (
    <div className={`fault-bar ${current ? 'active' : ''}`}>
      <strong>{current ? 'FALHA INJETADA' : 'Falha ao vivo'}</strong>
      {current
        ? <span>{current.label} · {br(fault.elapsed, 0)} s · {current.effect}</span>
        : <span className="muted">{fault.available ? 'Escolha um caso' : fault.error ?? 'Indisponível'}</span>}
      <div className="fault-buttons">
        {faults.map((f) => (
          <button type="button" key={f.id} disabled={!fault.available} className={fault.active === f.id ? 'on' : ''} title={f.effect} onClick={() => fault.start(f.id)}>{f.label}</button>
        ))}
        <button type="button" className="normalize" disabled={!current} onClick={() => fault.clear()}>Normalizar</button>
      </div>
    </div>
  )
}

function Header({ route, t }) {
  const setMode = (search) => route.go(route.path, search)
  const link = (path) => `${path}${route.search}`
  const bench = t.benchState
  const benchNote = bench.online ? 'conectada' : bench.seen && !bench.sensor_ok ? 'INA228 ausente' : bench.seen ? 'sinal perdido' : 'sem hardware'
  return (
    <header className="topbar">
      <a className="brand" href={link('/operacao')} onClick={(e) => { e.preventDefault(); route.go('/operacao') }}>
        <img src="/logo-mark.png" alt="" /><strong>MACHFORCE</strong>
      </a>
      <nav aria-label="Telas">
        {NAV.map(([path, label]) => (
          <a key={path} href={link(path)} aria-current={route.path === path ? 'page' : undefined} onClick={(e) => { e.preventDefault(); route.go(path) }}>{label}</a>
        ))}
      </nav>
      <div className="source" role="group" aria-label="Fonte de dados">
        <button type="button" className={t.mode === 'sim' ? 'on' : ''} onClick={() => setMode('')}>Simulador</button>
        <button type="button" className={t.demo ? 'on' : ''} onClick={() => setMode('?demo')}>Demo local</button>
        <button type="button" className={t.bench ? 'on' : ''} disabled={!bench.online && !t.bench} onClick={() => setMode('?fonte=bancada')}>Bancada<small>{benchNote}</small></button>
        <button type="button" disabled>Veículo<small>sem hardware</small></button>
      </div>
      <SimTag bench={t.bench} />
    </header>
  )
}

function SessionLine({ t }) {
  const s = t.latest
  return (
    <div className="session-line">
      <span>{s ? (t.bench ? `${s.session_id} · energia ${br(s.energy_wh, 3)} Wh` : `${s.session_id} · Volta ${Math.min(s.lap, 10)}/10 · ${br(s.distance / 1000, 2)} km`) : t.connected ? 'Aguardando amostras' : 'Sem conexão com a API. Use a Demo local para operar sem backend.'}</span>
      <span className="muted">{t.bench ? 'Medido na bancada: tensão, corrente, potência e energia. Demais valores indisponíveis.' : 'Simulação do gêmeo digital. Nenhum valor foi medido no veículo.'}</span>
    </div>
  )
}

export default function App() {
  const route = useRoute()
  const params = new URLSearchParams(route.search)
  const mode = params.has('demo') ? 'demo' : params.get('fonte') === 'bancada' ? 'bench' : 'sim'
  const t = useTelemetry(mode)
  const path = route.path === '/' ? '/operacao' : route.path
  const href = (target) => `${target}${route.search}`

  useEffect(() => {
    const label = NAV.find(([p]) => p === path)?.[1] ?? { '/piloto': 'Piloto', '/mecanica': 'Mecânica', '/box': 'Box' }[path] ?? 'Operação'
    document.title = `MachForce · ${label}`
  }, [path])

  if (FULL[path]) return <FullDisplay name={FULL[path]} t={t} />
  return (
    <div className="app">
      <Header route={{ ...route, path }} t={t} />
      <FaultBar t={t} onSimulator={() => route.go(path, '')} />
      <SessionLine t={t} />
      <main className="page">
        {path === '/diagnostico' && <Diagnostico t={t} />}
        {path === '/sinais' && <Sinais t={t} />}
        {path === '/eficiencia' && <Eficiencia />}
        {path === '/alertas' && <Alertas t={t} />}
        {path === '/displays' && <Displays t={t} href={href} />}
        {!NAV.some(([p]) => p === path && p !== '/operacao') && <Operacao t={t} />}
      </main>
    </div>
  )
}
