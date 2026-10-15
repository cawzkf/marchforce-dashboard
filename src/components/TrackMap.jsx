import { useCallback, useMemo, useRef, useState } from 'react'
import { has, kmh, num } from '../format'
import { VHI, VLO, bearing, comma, distanceM, gpsStatus, hasFix, recentFix, speedColor, speedDelta } from '../gps'
import GpsMap from './GpsMap'
import { clearDemoOrigin, setDemoOrigin } from '../useDemoTelemetry'

const W = 640
const H = 360
const PAD = 28
const HEADING_BACK_M = 6

export function TraceView({ series }) {
  const [hover, setHover] = useState(null)
  const outline = useRef({ session: null, pts: [], lastTs: -Infinity })

  const model = useMemo(() => {
    const pts = (series || []).filter((p) => p.x != null && p.y != null)
    if (pts.length === 0) return null
    const o = outline.current
    if (o.session !== pts[0].session_id) {
      o.session = pts[0].session_id
      o.pts = []
      o.lastTs = -Infinity
    }
    pts.forEach((p) => {
      if (p.timestamp <= o.lastTs) return
      o.lastTs = p.timestamp
      const lastPt = o.pts[o.pts.length - 1]
      if (!lastPt || Math.hypot(p.x - lastPt[0], p.y - lastPt[1]) > 2) o.pts.push([p.x, p.y])
    })
    if (o.pts.length > 4000) o.pts = o.pts.slice(-4000)
    const xs = o.pts.map((p) => p[0])
    const ys = o.pts.map((p) => p[1])
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const spanX = Math.max(...xs) - minX || 1
    const spanY = Math.max(...ys) - minY || 1
    const s = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
    const ox = (W - s * spanX) / 2
    const oy = (H - s * spanY) / 2
    const tx = (x) => ox + (x - minX) * s
    const ty = (y) => H - (oy + (y - minY) * s)
    const step = Math.max(1, Math.floor(pts.length / 240))
    const placed = pts
      .filter((_, i) => i % step === 0 || i === pts.length - 1)
      .map((p) => ({ ...p, sx: tx(p.x), sy: ty(p.y) }))
    const shape = o.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${tx(x).toFixed(1)},${ty(y).toFixed(1)}`).join(' ')
    return { placed, shape }
  }, [series])

  if (!model) return <p className="muted">Sem posição (x, y) na telemetria ainda.</p>

  const { placed, shape } = model
  const car = placed[placed.length - 1]
  const prev = placed.length > 1 ? placed[placed.length - 2] : car
  const heading = (Math.atan2(car.sy - prev.sy, car.sx - prev.sx) * 180) / Math.PI
  const hp = hover != null ? placed[hover] : null
  const tipX = hp ? Math.min(hp.sx + 10, W - 156) : 0
  const tipY = hp ? Math.max(hp.sy - 74, 6) : 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="track-svg" role="img" aria-label="Traçado da pista com posição atual">
      <path d={shape} className="track-line" />
      <path d={shape} className="track-center" />
      {placed.map((p, i) => (
        <circle
          key={i}
          cx={p.sx}
          cy={p.sy}
          r={hover === i ? 6 : 3.2}
          fill={speedColor(p.velocity)}
          stroke={hover === i ? '#fff' : 'none'}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
        />
      ))}
      <g transform={`translate(${car.sx}, ${car.sy})`}>
        <circle r={12} className="track-car-glow" />
        <polygon points="11,0 -7,-7 -7,7" className="track-car" transform={`rotate(${heading})`} />
      </g>
      <g className="track-hud" transform="translate(14, 22)">
        <text>{num(kmh(car.velocity), 1)} km/h</text>
        <text y="18" className="track-hud-sub">{(car.drive_phase ?? '').toUpperCase()}</text>
      </g>
      {hp && (
        <g className="track-tip" transform={`translate(${tipX}, ${tipY})`}>
          <rect width="146" height="66" rx="4" />
          <text x="8" y="17">v {num(kmh(hp.velocity), 1)} km/h</text>
          <text x="8" y="33">P {num(hp.electrical_power ?? hp.power, 0)} W</text>
          <text x="8" y="49">SoC {num(hp.soc, 1, 100)} %</text>
          <text x="82" y="49">Idc {num(hp.idc, 1)} A</text>
        </g>
      )}
    </svg>
  )
}

export function useGpsTrack(series, sessionKey) {
  const outline = useRef({ session: null, pts: [], lastTs: -Infinity })

  return useMemo(() => {
    const fixes = (series || []).filter(hasFix)
    if (fixes.length === 0) return null
    const o = outline.current
    const session = sessionKey ?? fixes[0].session_id
    if (o.session !== session) {
      o.session = session
      o.pts = []
      o.lastTs = -Infinity
    }
    fixes.forEach((p, i) => {
      const ts = p.timestamp ?? p.t ?? i
      if (ts <= o.lastTs) return
      o.lastTs = ts
      const last = o.pts[o.pts.length - 1]
      if (!last || distanceM({ lat: last[0], lon: last[1] }, p) > 2) o.pts.push([p.lat, p.lon])
    })
    if (o.pts.length > 4000) o.pts = o.pts.slice(-4000)
    const step = Math.max(1, Math.floor(fixes.length / 600))
    const path = fixes
      .filter((_, i) => i % step === 0 || i === fixes.length - 1)
      .map((p) => ({ lat: Number(p.lat), lon: Number(p.lon), velocity: p.velocity }))
    const last = fixes[fixes.length - 1]
    let back = null
    for (let i = fixes.length - 2; i >= 0; i -= 1) {
      if (distanceM(fixes[i], last) >= HEADING_BACK_M) {
        back = fixes[i]
        break
      }
    }
    const car = { lat: Number(last.lat), lon: Number(last.lon), heading: back ? bearing(back, last) : 0 }
    return { path, outline: o.pts.slice(), car }
  }, [series, sessionKey])
}

const ORIGIN_TEXT = {
  manual: 'no local escolhido no mapa',
  aparelho: 'na localização informada pelo aparelho',
  'padrão': 'no centro de Manaus (sem permissão de localização)',
}

const ROUTE_TEXT = {
  ruas: 'trajeto pelas ruas (OpenStreetMap, rota calculada pelo OSRM)',
  'sintética': 'trajeto sintético (sem conexão com o roteador)',
}

function precision(m) {
  return m >= 1000 ? `± ${comma(m / 1000, 1)} km` : `± ${Math.round(m)} m`
}

export default function TrackMap({ series, latest }) {
  const [choice, setChoice] = useState(null)
  const [tileFail, setTileFail] = useState(false)
  const [follow, setFollow] = useState(false)
  const gpsOk = recentFix(series)
  const routeKey = latest?.demo_route_key != null ? `${latest.session_id}:${latest.demo_route_key}` : undefined
  const gps = useGpsTrack(gpsOk ? series : null, routeKey)
  const status = gpsStatus(latest)
  const delta = speedDelta(latest)
  const onTileFail = useCallback(() => setTileFail(true), [])

  const wanted = choice ?? (gpsOk ? 'map' : 'trace')
  const showMap = wanted === 'map' && gpsOk && gps && !tileFail
  let note = null
  if (wanted === 'map' && tileFail) note = 'Mapa indisponível sem conexão com o servidor de mapas. Exibindo o traçado local.'
  else if (wanted === 'map' && !gpsOk && choice === 'map') note = 'Sem fix de GPS nas amostras recentes. Exibindo o traçado local.'

  const demoOrigin = latest?.demo_origin ?? null
  const demoRoute = latest?.demo_route ?? null

  const pick = (mode) => {
    if (mode === 'map') setTileFail(false)
    setChoice(mode)
  }

  return (
    <section className="panel track">
      <header className="panel-head track-head">
        <h2>Pista</h2>
        <div className="seg" role="group" aria-label="Visualização da pista">
          <button
            type="button"
            className={showMap ? 'active' : ''}
            onClick={() => pick('map')}
            disabled={!gpsOk}
            title={gpsOk ? 'Mapa real com posição GPS' : 'Sem fix de GPS nas amostras recentes'}
          >
            Mapa
          </button>
          <button type="button" className={!showMap ? 'active' : ''} onClick={() => pick('trace')}>Traçado</button>
        </div>
        <span className={`gps-chip gps-${status.level}`} title="Satélites e diluição horizontal de precisão (HDOP)">
          <i aria-hidden="true" />
          {status.text}
        </span>
        <span className="panel-tag">
          Volta <b>{has(latest?.lap) ? latest.lap : '--'}</b> · {num(latest?.lap_distance, 0)} m na volta
        </span>
      </header>

      {showMap ? (
        <GpsMap path={gps.path} outline={gps.outline} plan={demoOrigin ? latest.demo_route_plan : undefined} car={gps.car} follow={follow} onTileFail={onTileFail}
          onContextPick={demoOrigin ? setDemoOrigin : undefined}>
          <div className="gps-hud">
            <span className="gps-hud-speed">{num(kmh(latest?.velocity), 1)} km/h</span>
            <span className="gps-hud-sub">{(latest?.drive_phase ?? '').toUpperCase()}</span>
          </div>
          <button type="button" className={`gps-follow ${follow ? 'on' : ''}`} onClick={() => setFollow((f) => !f)} aria-pressed={follow}
            title={follow ? 'Centralizado no carro. Clique para enquadrar o trajeto inteiro.' : 'Enquadrando o trajeto inteiro. Clique para seguir o carro.'}
          >
            {follow ? 'Seguindo o carro' : 'Trajeto inteiro'}
          </button>
        </GpsMap>
      ) : (
        <TraceView series={series} />
      )}
      {note && <p className="track-note">{note}</p>}
      {demoOrigin && (
        <p className="track-note">
          Demo posicionada {ORIGIN_TEXT[demoOrigin] ?? demoOrigin}
          {demoOrigin === 'aparelho' && Number.isFinite(latest?.demo_origin_accuracy)
            ? ` (precisão de ${precision(latest.demo_origin_accuracy)}${latest.demo_origin_accuracy > 200 ? ', aproximada por rede: o notebook não tem GPS' : ''})`
            : ''}
          {demoRoute ? `, ${ROUTE_TEXT[demoRoute] ?? demoRoute}` : ''}
          . Clique com o botão direito no mapa para posicionar a pista em outro lugar.
          {demoOrigin === 'manual' && (
            <> <button type="button" className="link-btn" onClick={clearDemoOrigin}>Usar a localização do aparelho</button></>
          )}
        </p>
      )}

      <div className="track-legend">
        <span>{VLO} km/h</span>
        <i className="track-ramp" />
        <span>{VHI} km/h</span>
        <span className="muted">
          {showMap ? 'Rastro GPS recente, cor = velocidade.' : 'Rastro recente, cor = velocidade. Passe o mouse num ponto.'}
        </span>
        {gpsOk && (
          <span className="gps-delta" title="Velocidade GPS menos velocidade da roda (sensor Hall)">
            v GPS <b>{comma(kmh(latest?.gps_speed), 1)}</b> km/h · Δ roda <b>{delta === null ? '--' : `${delta >= 0 ? '+' : ''}${comma(delta, 1)}`}</b> km/h
          </span>
        )}
      </div>
    </section>
  )
}
