const OSRM = 'https://router.project-osrm.org/route/v1/driving'
const TIMEOUT_MS = 6000
const MIN_GAP_MS = 2000
const CACHE_KEY = 'mf-demo-road-loops'
const CACHE_MAX = 12
const WAYPOINTS = 5
const SPUR_MAX_M = 400
const SPUR_JOIN_M = 3
const MAX_LOOP_FACTOR = 6
const M_PER_DEG = 111320

let lastRequestAt = 0

function cacheId(lat, lon, radiusM) {
  return `${lat.toFixed(4)},${lon.toFixed(4)},${Math.round(radiusM)}`
}

function readCache() {
  try {
    const v = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

function writeCache(id, loop) {
  try {
    const all = readCache()
    all[id] = { ...loop, at: Date.now() }
    const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, CACHE_MAX)
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(keep)))
  } catch (e) { void e }
}

function meters(a, b) {
  const k = Math.PI / 180
  const x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * k)
  const y = b.lat - a.lat
  return Math.hypot(x, y) * M_PER_DEG
}

function waypoints(lat, lon, radiusM) {
  const cos = Math.cos((lat * Math.PI) / 180)
  const out = []
  for (let i = 0; i < WAYPOINTS; i += 1) {
    const th = Math.PI / 2 - (i / WAYPOINTS) * 2 * Math.PI
    out.push({ lat: lat + (radiusM * Math.sin(th)) / M_PER_DEG, lon: lon + (radiusM * Math.cos(th)) / (M_PER_DEG * cos) })
  }
  return out
}

function dedupe(points) {
  return points.filter((p, i) => i === 0 || meters(points[i - 1], p) > 0.5)
}

/** Cuts out-and-back spurs: whenever the path returns to a point it left less than SPUR_MAX_M ago, the detour is dropped. */
function dropSpurs(points) {
  let pts = dedupe(points)
  let changed = true
  while (changed) {
    changed = false
    const total = pts.reduce((acc, p, i) => (i ? acc + meters(pts[i - 1], p) : 0), 0)
    for (let i = 0; i < pts.length - 2 && !changed; i += 1) {
      let run = 0
      for (let j = i + 1; j < pts.length - 1; j += 1) {
        run += meters(pts[j - 1], pts[j])
        if (run > SPUR_MAX_M || run > total * 0.4) break
        if (j > i + 1 && run > 2 * SPUR_JOIN_M && meters(pts[i], pts[j]) < SPUR_JOIN_M) {
          pts = [...pts.slice(0, i + 1), ...pts.slice(j + 1)]
          changed = true
          break
        }
      }
    }
  }
  return pts
}

/** Start and end both sit on the first waypoint; if it snapped into a dead end, the spur straddles the seam and is trimmed here. */
function trimSeam(points) {
  let pts = points
  while (pts.length > 6 && meters(pts[0], pts[pts.length - 1]) < SPUR_JOIN_M && meters(pts[1], pts[pts.length - 2]) < SPUR_JOIN_M) {
    pts = pts.slice(1, -1)
  }
  return pts
}

function closeLoop(points) {
  const pts = trimSeam(points)
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (meters(first, last) > 0.5) pts.push({ ...first })
  return pts
}

function length(points) {
  let total = 0
  for (let i = 1; i < points.length; i += 1) total += meters(points[i - 1], points[i])
  return total
}

async function request(url, signal) {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  if (signal?.aborted) return null
  lastRequestAt = Date.now()
  const ctrl = new AbortController()
  const stop = () => ctrl.abort()
  signal?.addEventListener('abort', stop)
  const timer = setTimeout(stop, TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return await res.json()
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
}

/** Asks the public OSRM demo server for a closed street loop around (lat, lon); null on any failure so the caller keeps the synthetic track. */
export async function buildRoadLoop(lat, lon, radiusM = 250, signal) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const id = cacheId(lat, lon, radiusM)
  const cached = readCache()[id]
  if (cached?.points?.length > 2) return { points: cached.points, lengthM: cached.lengthM }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null
  const wps = waypoints(lat, lon, radiusM)
  const coords = [...wps, wps[0]].map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${OSRM}/${coords}?overview=full&geometries=geojson&continue_straight=true&steps=false`
  try {
    const data = await request(url, signal)
    const line = data?.code === 'Ok' ? data.routes?.[0]?.geometry?.coordinates : null
    if (!Array.isArray(line) || line.length < 4) return null
    const points = closeLoop(dropSpurs(line.map(([x, y]) => ({ lat: y, lon: x }))))
    const lengthM = length(points)
    if (points.length < 4 || lengthM < radiusM || lengthM > MAX_LOOP_FACTOR * 2 * Math.PI * radiusM) return null
    const loop = { points: points.map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) })), lengthM: Math.round(lengthM) }
    writeCache(id, loop)
    return loop
  } catch {
    return null
  }
}
