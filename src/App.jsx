import { useRef, useState } from 'react'
import { useLiveTelemetry } from './useLiveTelemetry'
import { useDemoTelemetry } from './useDemoTelemetry'
import StatusBar from './components/StatusBar'
import HeroRow from './components/HeroRow'
import KpiCards from './components/KpiCards'
import PowertrainPanel from './components/PowertrainPanel'
import ThermalPanel from './components/ThermalPanel'
import BatteryPanel from './components/BatteryPanel'
import LiveCharts from './components/LiveCharts'
import AlertsPanel from './components/AlertsPanel'
import TrackMap from './components/TrackMap'
import Endpoints from './components/Endpoints'
import Parameters from './components/Parameters'
import SessionHistory from './components/SessionHistory'

function initialDemo() {
  return new URLSearchParams(window.location.search).has('demo')
}

export default function App() {
  const [tab, setTab] = useState('live')
  const [demo, setDemo] = useState(initialDemo)
  const live = useLiveTelemetry()
  const demoData = useDemoTelemetry(demo)
  const { latest, series, connected } = demo ? demoData : live
  const start = useRef({ session: null, ts: null })

  if (latest && latest.session_id !== start.current.session) {
    start.current = { session: latest.session_id, ts: series[0]?.timestamp ?? latest.timestamp }
  }
  const elapsed = latest && start.current.ts ? latest.timestamp - start.current.ts : null

  return (
    <div className="app">
      <StatusBar
        demo={demo}
        onToggleDemo={() => setDemo((d) => !d)}
        connected={connected}
        latest={latest}
        elapsed={elapsed}
        tab={tab}
        onTab={setTab}
      />

      {tab === 'live' && (
        <main className="live">
          <HeroRow latest={latest} />
          <KpiCards latest={latest} />
          <div className="systems">
            <PowertrainPanel latest={latest} />
            <ThermalPanel latest={latest} series={series} />
            <BatteryPanel latest={latest} />
            <AlertsPanel alerts={latest?.alerts ?? []} timestamp={latest?.timestamp} sessionId={latest?.session_id} />
          </div>
          <div className="analysis">
            <TrackMap series={series} latest={latest} />
            <LiveCharts series={series} />
          </div>
        </main>
      )}
      {tab === 'history' && (
        <main className="history">
          <SessionHistory />
        </main>
      )}
      {tab === 'system' && (
        <main className="system">
          <Endpoints />
          <Parameters />
        </main>
      )}
    </div>
  )
}
