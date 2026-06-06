import { useState } from 'react'
import { useLiveTelemetry } from './useLiveTelemetry'
import { useDemoTelemetry } from './useDemoTelemetry'
import StatusBar from './components/StatusBar'
import KpiCards from './components/KpiCards'
import LiveCharts from './components/LiveCharts'
import AlertsPanel from './components/AlertsPanel'
import TrackMap from './components/TrackMap'
import Endpoints from './components/Endpoints'
import Parameters from './components/Parameters'
import SessionHistory from './components/SessionHistory'

export default function App() {
  const [tab, setTab] = useState('live')
  const [demo, setDemo] = useState(false)
  const live = useLiveTelemetry()
  const demoData = useDemoTelemetry(demo)
  const { latest, series, connected } = demo ? demoData : live

  return (
    <div className="app">
      <header className="app-header">
        <h1>MarchForce · Telemetria</h1>
        <nav className="tabs">
          <button className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>
            Ao vivo
          </button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            Sessões
          </button>
          <button className={`demo-toggle ${demo ? 'on' : ''}`} onClick={() => setDemo((d) => !d)}>
            Demo {demo ? 'on' : 'off'}
          </button>
        </nav>
      </header>

      {tab === 'live' ? (
        <main className="live">
          <StatusBar connected={connected} latest={latest} />
          <Endpoints />
          <div className="live-top">
            <TrackMap series={series} />
            <div className="live-side">
              <KpiCards latest={latest} />
              <AlertsPanel alerts={latest?.alerts ?? []} />
            </div>
          </div>
          <LiveCharts series={series} />
          <Parameters />
        </main>
      ) : (
        <main className="history">
          <SessionHistory />
        </main>
      )}
    </div>
  )
}
