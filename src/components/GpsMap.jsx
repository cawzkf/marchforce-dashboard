import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { speedColor, VHI, VLO } from '../gps'

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const BASES = {
  dark: {
    label: 'Escuro',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTR} contributors`,
    maxNativeZoom: 19,
  },
  osm: {
    label: 'Ruas',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTR} contributors`,
    maxNativeZoom: 19,
  },
  sat: {
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics e GIS User Community',
    maxNativeZoom: 19,
  },
}

const BUCKETS = 12
const FAIL_ERRORS = 4
const FAIL_TIMEOUT_MS = 10000

const CAR_ICON = L.divIcon({
  className: 'gps-car-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html:
    '<svg viewBox="-15 -15 30 30" width="30" height="30"><circle r="13" class="track-car-glow"/>'
    + '<polygon class="track-car" points="0,-11 7,7 0,3 -7,7"/></svg>',
})

function speedRuns(path) {
  const runs = []
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]
    const b = path[i]
    const r = Math.min(1, Math.max(0, ((b.velocity ?? 0) * 3.6 - VLO) / (VHI - VLO)))
    const bucket = Math.round(r * (BUCKETS - 1))
    const last = runs[runs.length - 1]
    if (last && last.bucket === bucket) last.pts.push([b.lat, b.lon])
    else runs.push({ bucket, color: speedColor((VLO + (bucket / (BUCKETS - 1)) * (VHI - VLO)) / 3.6), pts: [[a.lat, a.lon], [b.lat, b.lon]] })
  }
  return runs
}

function Viewport({ path, outline, follow, car }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])

  useEffect(() => {
    if (!car) return
    if (follow) {
      map.setView([car.lat, car.lon], Math.max(map.getZoom() || 17, 17), { animate: false })
      fitted.current = false
      return
    }
    const pts = outline.length > 1 ? outline : path.map((p) => [p.lat, p.lon])
    if (pts.length < 2) {
      map.setView([car.lat, car.lon], 17, { animate: false })
      return
    }
    const bounds = L.latLngBounds(pts)
    if (!fitted.current || !map.getBounds().contains(bounds)) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 18, animate: false })
      fitted.current = true
    }
  }, [map, path, outline, follow, car])

  return null
}

function TileWatch({ base, onFail }) {
  const stats = useRef({ loads: 0, errors: 0 })

  useEffect(() => {
    stats.current = { loads: 0, errors: 0 }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      onFail?.()
      return undefined
    }
    const id = setTimeout(() => {
      if (stats.current.loads === 0) onFail?.()
    }, FAIL_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [base, onFail])

  const b = BASES[base]
  return (
    <TileLayer
      key={base}
      url={b.url}
      attribution={b.attribution}
      subdomains={b.subdomains ?? 'abc'}
      maxNativeZoom={b.maxNativeZoom}
      maxZoom={21}
      eventHandlers={{
        tileload: () => { stats.current.loads += 1 },
        tileerror: () => {
          stats.current.errors += 1
          if (stats.current.loads === 0 && stats.current.errors >= FAIL_ERRORS) onFail?.()
        },
      }}
    />
  )
}

function CarMarker({ car }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current?.getElement()?.querySelector('svg')
    if (el) el.style.transform = `rotate(${car.heading ?? 0}deg)`
  })
  return <Marker ref={ref} position={[car.lat, car.lon]} icon={CAR_ICON} interactive={false} keyboard={false} />
}

function ContextPick({ onPick }) {
  useMapEvents({ contextmenu: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

export default function GpsMap({ path, outline = [], car, follow = false, onTileFail, onContextPick, controls = true, children }) {
  const [base, setBase] = useState('dark')
  const runs = useMemo(() => speedRuns(path), [path])
  const center = car ?? path[path.length - 1]

  if (!center) return null

  return (
    <div className={`gps-map base-${base}`}>
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={17}
        maxZoom={21}
        preferCanvas
        zoomControl={controls}
        attributionControl
        scrollWheelZoom={false}
        className="gps-map-leaflet"
      >
        <TileWatch base={base} onFail={onTileFail} />
        {onContextPick && <ContextPick onPick={onContextPick} />}
        {outline.length > 1 && <Polyline positions={outline} pathOptions={{ color: '#5a5a5a', weight: 10, opacity: 0.55, lineCap: 'round', lineJoin: 'round' }} />}
        {runs.map((r, i) => (
          <Polyline key={i} positions={r.pts} pathOptions={{ color: r.color, weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
        ))}
        {car && <CarMarker car={car} />}
        <Viewport path={path} outline={outline} follow={follow} car={center} />
      </MapContainer>
      {controls && (
        <div className="gps-bases" role="group" aria-label="Camada do mapa">
          {Object.entries(BASES).map(([id, b]) => (
            <button key={id} type="button" className={base === id ? 'active' : ''} onClick={() => setBase(id)}>{b.label}</button>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}
