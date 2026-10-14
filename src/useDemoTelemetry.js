import { useEffect, useRef, useState } from 'react'

const WINDOW = 600
const DT = 0.1

const MASS = 115
const CRR = 0.0045
const CDA = 0.11
const RHO = 1.18
const G = 9.81
const WHEEL_R = 0.254
const GEAR = 9.31
const GEAR_EFF = 0.95
const T_MAX = 1.2
const CAPACITY_J = 512 * 3600
const SOC0 = 0.92
const CELLS = 16

const ORIGIN_LAT = -3.119
const ORIGIN_LON = -60.0217
const ORIGIN_KEY = 'mf-demo-origin'
const ORIGIN_EVENT = 'mf-demo-origin'

function storedOrigin() {
  try {
    const v = JSON.parse(window.localStorage.getItem(ORIGIN_KEY) || 'null')
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lon) ? v : null
  } catch {
    return null
  }
}

export function setDemoOrigin(lat, lon) {
  try { window.localStorage.setItem(ORIGIN_KEY, JSON.stringify({ lat, lon })) } catch (e) { void e }
  window.dispatchEvent(new CustomEvent(ORIGIN_EVENT, { detail: { lat, lon, source: 'manual' } }))
}

export function clearDemoOrigin() {
  try { window.localStorage.removeItem(ORIGIN_KEY) } catch (e) { void e }
  window.dispatchEvent(new CustomEvent(ORIGIN_EVENT, { detail: { source: 'aparelho' } }))
}
const M_PER_DEG = 111320

const CELL_OFFSET = [4, -6, 9, -2, 1, -11, 7, 3, -4, 12, -8, 0, 5, -3, -9, 6].map((mv) => mv / 1000)
const CELL_R = [12, 11.5, 13, 12.2, 11.8, 14, 12.5, 11.9, 12.1, 13.4, 12.8, 11.6, 12.3, 12.9, 13.8, 12].map((mo) => mo / 1000)

function buildTrack() {
  const n = 1200
  const pts = []
  for (let i = 0; i <= n; i += 1) {
    const th = (i / n) * 2 * Math.PI
    pts.push([
      170 * Math.cos(th) + 22 * Math.cos(2 * th),
      78 * Math.sin(th) - 18 * Math.sin(2 * th) + 6 * Math.sin(5 * th),
    ])
  }
  const cum = [0]
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  }
  return { pts, cum, length: cum[cum.length - 1] }
}

const TRACK = buildTrack()

function trackPos(d) {
  const s = ((d % TRACK.length) + TRACK.length) % TRACK.length
  let lo = 0
  let hi = TRACK.cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (TRACK.cum[mid] <= s) lo = mid
    else hi = mid
  }
  const f = (s - TRACK.cum[lo]) / (TRACK.cum[hi] - TRACK.cum[lo] || 1)
  const [x0, y0] = TRACK.pts[lo]
  const [x1, y1] = TRACK.pts[hi]
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]
}

function noise(scale) {
  return (Math.random() + Math.random() + Math.random() - 1.5) * scale
}

function gpsFix(s, x, y) {
  s.gpsErrX = s.gpsErrX * 0.97 + noise(0.73)
  s.gpsErrY = s.gpsErrY * 0.97 + noise(0.73)
  if (Math.random() < 0.004) s.sats = Math.min(12, Math.max(7, s.sats + (Math.random() < 0.5 ? -1 : 1)))
  const ex = s.gpsErrX + noise(0.6)
  const ey = s.gpsErrY + noise(0.6)
  return {
    lat: s.originLat + (y + ey) / M_PER_DEG,
    lon: s.originLon + (x + ex) / (M_PER_DEG * Math.cos((s.originLat * Math.PI) / 180)),
    gps_sats: s.sats,
    gps_hdop: +(0.45 + 4.5 / s.sats + noise(0.04)).toFixed(2),
    gps_speed: Math.max(0, s.v + noise(0.3)),
    gps_fix: true,
    demo_origin: s.originSource,
    demo_origin_accuracy: s.originAccuracy,
  }
}

function ocv(soc) {
  return 3.2 + 0.13 * soc + 0.25 * soc ** 20 - 0.5 * (1 - soc) ** 15
}

function rand(a, b) {
  return a + Math.random() * (b - a)
}

function initialState() {
  const amb = 31
  return {
    t: 0, v: 0, dist: 0, phase: 'idle',
    burnTop: rand(8.6, 9.6), coastLow: rand(4.2, 4.9),
    eMech: 0, eElec: 0, avgPower: 0, peakI: 0,
    amb, tBat: amb + 4, tMotor: amb + 20, tCtrl: amb + 12,
    eta: 0.86, lap: 1,
    gpsErrX: 0, gpsErrY: 0, sats: 10,
    originLat: ORIGIN_LAT, originLon: ORIGIN_LON, originSource: 'padrão', originAccuracy: null,
    session: `demo-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`,
  }
}

function alertsFor(s, sample) {
  const out = []
  const add = (code, severity, message, value) => out.push({ code, severity, message, value })
  if (sample.soc < 0.15) add('E-SOC-CRITICAL', 'error', 'Estado de carga crítico', +(sample.soc * 100).toFixed(1))
  else if (sample.soc < 0.3) add('W-SOC-LOW', 'warning', 'Estado de carga baixo', +(sample.soc * 100).toFixed(1))
  if (sample.idc > 30) add('E-IDC-OVERCURRENT', 'error', 'Sobrecorrente no barramento DC', +sample.idc.toFixed(1))
  else if (sample.idc > 11) add('W-IDC-HIGH', 'warning', 'Corrente DC elevada', +sample.idc.toFixed(1))
  const thermal = [
    ['motor_temp', 'W-MOTOR-TEMP', 'E-MOTOR-OVERTEMP', 'do motor', 90, 125],
    ['controller_temp', 'W-CTRL-TEMP', 'E-CTRL-OVERTEMP', 'do controlador', 70, 85],
    ['battery_temp', 'W-BATT-TEMP', 'E-BATT-OVERTEMP', 'da bateria', 45, 60],
  ]
  thermal.forEach(([key, warnCode, critCode, name, warn, crit]) => {
    const v = sample[key]
    if (v >= crit) add(critCode, 'error', `Temperatura ${name} crítica`, +v.toFixed(1))
    else if (v >= warn) add(warnCode, 'warning', `Temperatura ${name} elevada`, +v.toFixed(1))
  })
  return out
}

function step(s) {
  if (s.phase === 'idle' && s.t >= 4) s.phase = 'burn'
  if (s.phase === 'burn' && s.v >= s.burnTop) {
    s.phase = 'coast'
    s.coastLow = rand(4.2, 4.9)
  } else if (s.phase === 'coast' && s.v <= s.coastLow) {
    s.phase = 'burn'
    s.burnTop = rand(8.6, 9.6)
  }

  const grade = 0.006 * Math.sin((2 * Math.PI * s.dist) / TRACK.length + 0.8)
  const resist = CRR * MASS * G + 0.5 * RHO * CDA * s.v * s.v + MASS * G * grade
  const fMax = (T_MAX * GEAR * GEAR_EFF) / WHEEL_R
  const pCmd = 235 + 25 * Math.sin(s.t / 7)
  const force = s.phase === 'burn' ? Math.min(fMax, pCmd / Math.max(s.v, 0.5)) : 0
  const acc = s.phase === 'idle' ? 0 : (force - resist) / MASS
  s.v = Math.max(0, s.v + acc * DT)

  const omega = (s.v / WHEEL_R) * GEAR
  const rpm = (omega * 60) / (2 * Math.PI)
  const pWheel = force * s.v
  const pShaft = pWheel / GEAR_EFF
  const torque = force > 0 ? (force * WHEEL_R) / (GEAR * GEAR_EFF) : 0
  if (s.phase === 'burn') {
    s.eta = 0.8 + 0.08 * Math.min(1, rpm / 3000) - 0.04 * Math.max(0, pShaft / 200 - 1) + noise(0.004)
  }
  const pElec = s.phase === 'burn' ? pShaft / s.eta + 4 : s.phase === 'coast' ? 4 : 3

  const soc = Math.max(0, SOC0 - s.eElec / CAPACITY_J)
  const base = ocv(soc)
  const iGuess = pElec / (CELLS * base)
  const cells = CELL_OFFSET.map((o, i) => base + o * (1 + (0.5 - soc)) - iGuess * CELL_R[i] + noise(0.0015))
  const vdc = cells.reduce((a, b) => a + b, 0) - iGuess * 0.02
  const idc = pElec / vdc
  s.peakI = Math.max(s.peakI, idc)

  s.amb = 31 + 0.6 * Math.sin(s.t / 240)
  const motorLoss = s.phase === 'burn' ? pShaft * (1 / s.eta - 1) + 1 : 0.5
  const ctrlLoss = 0.03 * pElec + 1.5
  const batLoss = idc * idc * 0.21
  s.tMotor += ((s.amb + motorLoss * 1.6 - s.tMotor) / 120) * DT
  s.tCtrl += ((s.amb + ctrlLoss * 3.5 - s.tCtrl) / 60) * DT
  s.tBat += ((s.amb + batLoss * 1.5 + 1 - s.tBat) / 400) * DT

  s.eMech += pWheel * DT
  s.eElec += pElec * DT
  s.avgPower += ((pWheel - s.avgPower) / 30) * DT
  s.dist += s.v * DT
  s.t += DT

  const lap = Math.floor(s.dist / TRACK.length) + 1
  if (lap > s.lap) {
    s.lap = lap
  }

  const [x, y] = trackPos(s.dist)
  const energyWh = s.eElec / 3600
  const cellMin = Math.min(...cells)
  const cellMax = Math.max(...cells)
  const sample = {
    session_id: s.session,
    timestamp: Date.now() / 1000,
    velocity: s.v,
    acceleration: acc,
    vdc,
    idc,
    power: pWheel,
    energy: s.eMech,
    soc,
    distance: s.dist,
    avg_power: s.avgPower,
    specific_consumption: s.dist > 1 ? s.eMech / 3600 / s.dist : 0,
    autonomy: s.avgPower > 1 ? (soc * CAPACITY_J) / Math.max(pElec, s.avgPower) : 0,
    x,
    y,
    ...gpsFix(s, x, y),
    battery_temp: s.tBat + noise(0.05),
    motor_temp: s.tMotor + noise(0.1),
    controller_temp: s.tCtrl + noise(0.1),
    ambient_temp: s.amb + noise(0.05),
    motor_rpm: rpm,
    motor_torque: torque,
    motor_efficiency: s.phase === 'burn' ? s.eta : null,
    electrical_power: pElec,
    cell_voltage_min: cellMin,
    cell_voltage_avg: cells.reduce((a, b) => a + b, 0) / CELLS,
    cell_voltage_max: cellMax,
    battery_current_peak: s.peakI,
    energy_wh: energyWh,
    km_per_kwh: energyWh > 0.2 ? s.dist / 1000 / (energyWh / 1000) : null,
    drive_phase: s.phase,
    lap,
    lap_distance: s.dist % TRACK.length,
  }
  sample.alerts = alertsFor(s, sample)
  return sample
}

export function useDemoTelemetry(enabled) {
  const [latest, setLatest] = useState(null)
  const [series, setSeries] = useState([])
  const st = useRef(initialState())

  useEffect(() => {
    if (!enabled) return undefined
    st.current = initialState()
    setSeries([])
    setLatest(null)
    let cancelled = false
    const place = (lat, lon, source, accuracy = null) => {
      Object.assign(st.current, { originLat: lat, originLon: lon, originSource: source, originAccuracy: accuracy })
      setSeries([])
    }
    const fromDevice = () => {
      if (!window.isSecureContext || !navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        (pos) => { if (!cancelled && !storedOrigin()) place(pos.coords.latitude, pos.coords.longitude, 'aparelho', pos.coords.accuracy) },
        () => {},
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      )
    }
    const manual = storedOrigin()
    if (manual) place(manual.lat, manual.lon, 'manual')
    else fromDevice()
    const onOrigin = (e) => {
      if (e.detail.source === 'manual') place(e.detail.lat, e.detail.lon, 'manual')
      else { place(ORIGIN_LAT, ORIGIN_LON, 'padrão'); fromDevice() }
    }
    window.addEventListener(ORIGIN_EVENT, onOrigin)
    const id = setInterval(() => {
      const sample = step(st.current)
      setLatest(sample)
      setSeries((prev) => {
        const next = [...prev, sample]
        return next.length > WINDOW ? next.slice(next.length - WINDOW) : next
      })
    }, DT * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener(ORIGIN_EVENT, onOrigin)
    }
  }, [enabled])

  return { latest, series, connected: enabled }
}
