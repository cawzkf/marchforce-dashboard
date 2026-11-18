import { ALERT_BY_CODE, FAULT_RAMPS, LIMITS, PACK, RACE } from '../data/catalog'
import track from '../data/track.json'

const P = {
  mass: 140, cr: 0.003, cda: 0.05, rho: 1.225, g: 9.81, radius: 0.2065, gear: 149 / 16,
  etaGear: 0.97, etaInverter: 0.97, aux: 3, kt: 0.115, ke: 0.1146, ra: 0.236, i0: 0.419,
  cellR: 0.02, imbalance: 0.01, torque: 0.75, burn: 33 / 3.6, coast: 16 / 3.6, ambient: 30,
}
const PRECHARGE_END_S = 1
const DEAD_MAN_AT_S = 4
const STANDING_START_S = 7
const NODES = { motor: [2.5, 500], inverter: [4, 150], battery: [1.5, 2600] }
const OCV = [[0, 2.5], [0.05, 2.95], [0.1, 3.15], [0.2, 3.22], [0.3, 3.25], [0.4, 3.27], [0.5, 3.28],
  [0.6, 3.29], [0.7, 3.3], [0.8, 3.32], [0.9, 3.34], [0.95, 3.38], [1, 3.45]]

export function interpolate(points, t) {
  if (t <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i += 1) {
    const [t0, v0] = points[i - 1]
    const [t1, v1] = points[i]
    if (t <= t1) return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
  }
  return points[points.length - 1][1]
}

export function faultOverrides(id, elapsed) {
  const ramps = FAULT_RAMPS[id] ?? {}
  return Object.fromEntries(Object.entries(ramps).map(([key, ramp]) => [key, interpolate(ramp, elapsed)]))
}

const relax = (temp, loss, [r, c], dt) => {
  const target = P.ambient + Math.max(loss, 0) * r
  return target + (temp - target) * Math.exp(-dt / (r * c))
}

function alert(code, value) {
  const info = ALERT_BY_CODE[code]
  return { code, severity: info.severity, message: info.message, value: value === null ? null : +value.toFixed(2) }
}

export function evaluate(s) {
  const out = []
  if (s.soc <= 0.15) out.push(alert('E-SOC-CRITICAL', s.soc * 100))
  else if (s.soc <= 0.3) out.push(alert('W-SOC-LOW', s.soc * 100))
  const cells = PACK.cells
  if (s.vdc <= cells * 2.5 || s.vdc >= 60) out.push(alert('E-VDC-RANGE', s.vdc))
  else if (s.vdc <= cells * 3 || s.vdc > cells * 3.65) out.push(alert('W-VDC-RANGE', s.vdc))
  const current = Math.abs(s.idc)
  if (current >= LIMITS.idc.crit) out.push(alert('E-IDC-OVERCURRENT', s.idc))
  else if (current >= LIMITS.idc.warn) out.push(alert('W-IDC-HIGH', s.idc))
  if (s.velocity >= 12.5) out.push(alert('E-SPEED-CRITICAL', s.velocity))
  else if (s.velocity >= 11.1) out.push(alert('W-SPEED-HIGH', s.velocity))
  ;[['battery_temp', 'W-BATT-TEMP', 'E-BATT-OVERTEMP'], ['motor_temp', 'W-MOTOR-TEMP', 'E-MOTOR-OVERTEMP'],
    ['controller_temp', 'W-CTRL-TEMP', 'E-CTRL-OVERTEMP']].forEach(([key, warn, crit]) => {
    if (s[key] >= LIMITS[key].crit) out.push(alert(crit, s[key]))
    else if (s[key] >= LIMITS[key].warn) out.push(alert(warn, s[key]))
  })
  return out
}

export const staleAlert = (silence) => alert('E-COMM-STALE', silence)

function trackPosition(distance) {
  const n = track.points.length
  const at = ((distance % RACE.lapLength) / RACE.lapLength) * n
  const i = Math.floor(at) % n
  const f = at - Math.floor(at)
  const [a, b] = [track.points[i], track.points[(i + 1) % n]]
  return { lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f }
}

export function vehicleSignals(t, velocity, o, samples) {
  const fault = (o.idc ?? 0) >= LIMITS.idc.crit ? 'overcurrent' : (o.controller_temp ?? 0) >= LIMITS.controller_temp.crit ? 'overtemp' : null
  const bmsOk = (o.vdc ?? 99) > PACK.cells * 2.5 && (o.battery_temp ?? 0) < LIMITS.battery_temp.crit
  const dcLink = t >= PRECHARGE_END_S && bmsOk
  const deadMan = t >= DEAD_MAN_AT_S
  let state = 'run'
  if (fault) state = 'fault'
  else if (t < PRECHARGE_END_S) state = 'precharge'
  else if (!deadMan) state = 'wait_dead_man'
  else if (t < STANDING_START_S && velocity <= 0.05) state = 'ready'
  return {
    dc_link_on: dcLink,
    inv_inputs: { estop_closed: true, bms_ok: bmsOk, dead_man: deadMan, enable: deadMan && dcLink && bmsOk && !fault },
    inv_state: state,
    inv_fault: fault,
    bus_age_ms: 20 + (samples % 4) * 20,
    bus_errors: 0,
  }
}

function ocv(soc) {
  const s = Math.min(1, Math.max(0, soc))
  return interpolate(OCV, s)
}

export function createDemoEngine(startTime = Date.now() / 1000) {
  const st = {
    t: 0, v: 0, distance: 0, phase: 'idle', wh: 0, ah: 0, mech: 0, peak: 0, avg: 0,
    motor: P.ambient, model: P.ambient, inverter: P.ambient, battery: P.ambient,
  }
  const session = `MF-demo-${new Date(startTime * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '')}`

  return function step(dt, fault) {
    if (st.phase === 'idle' && st.t >= STANDING_START_S) st.phase = 'burn'
    if (st.phase === 'burn' && st.v >= P.burn) st.phase = 'coast'
    if (st.phase === 'coast' && st.v <= P.coast) st.phase = 'burn'
    const resist = P.mass * P.g * P.cr + 0.5 * P.rho * P.cda * st.v * st.v
    const burning = st.phase === 'burn'
    const force = burning ? (P.torque * P.gear * P.etaGear) / P.radius : 0
    const accel = st.phase === 'idle' ? 0 : (force - (st.v > 0 || burning ? resist : 0)) / P.mass
    const omega = (st.v / P.radius) * P.gear
    const phaseCurrent = burning ? P.torque / P.kt + P.i0 : 0
    const motorInput = burning ? (P.ke * omega + P.ra * phaseCurrent) * phaseCurrent : 0
    const shaft = burning ? P.torque * omega : 0
    const motorLoss = Math.max(0, motorInput - shaft)
    const busPower = motorInput / P.etaInverter + P.aux
    const soc = Math.max(0, 1 - st.ah / PACK.capacityAh)
    const voc = PACK.cells * ocv(soc)
    const r = PACK.cells * P.cellR
    const modelI = (voc - Math.sqrt(Math.max(0, voc * voc - 4 * r * busPower))) / (2 * r)
    const modelV = voc - modelI * r

    st.motor = relax(st.motor, motorLoss, NODES.motor, dt)
    st.model = relax(st.model, motorLoss, NODES.motor, dt)
    st.inverter = relax(st.inverter, motorInput * (1 / P.etaInverter - 1), NODES.inverter, dt)
    st.battery = relax(st.battery, modelI * modelI * r, NODES.battery, dt)
    st.wh += (modelV * modelI * dt) / 3600
    st.ah += (modelI * dt) / 3600
    st.mech += force * st.v * dt
    st.peak = Math.max(st.peak, modelI)
    st.avg += ((force * st.v - st.avg) / 30) * dt
    st.distance += st.v * dt
    st.v = Math.max(0, st.v + accel * dt)
    st.t += dt

    const o = fault ? faultOverrides(fault.id, fault.elapsed) : {}
    st.samples = (st.samples ?? 0) + 1
    const vdc = o.vdc ?? modelV
    const idc = o.idc ?? modelI
    const cellAvg = vdc / PACK.cells
    const km = st.distance / 1000
    const sample = {
      session_id: session,
      timestamp: startTime + st.t,
      velocity: st.v,
      acceleration: accel,
      vdc,
      idc,
      power: force * st.v,
      energy: st.mech,
      soc: Math.max(0, 1 - st.ah / PACK.capacityAh),
      distance: st.distance,
      avg_power: st.avg,
      battery_temp: o.battery_temp ?? st.battery,
      motor_temp: o.motor_temp ?? st.motor,
      motor_temp_model: st.model,
      controller_temp: o.controller_temp ?? st.inverter,
      ambient_temp: P.ambient,
      motor_rpm: burning ? (omega * 60) / (2 * Math.PI) : 0,
      motor_torque: burning ? P.torque : 0,
      motor_efficiency: burning && motorInput > 0 ? shaft / motorInput : 0,
      electrical_power: vdc * idc,
      cell_voltage_min: cellAvg - P.imbalance,
      cell_voltage_avg: cellAvg,
      cell_voltage_max: cellAvg + P.imbalance,
      battery_current_peak: st.peak,
      energy_wh: st.wh,
      km_per_kwh: st.wh > 0.001 ? km / (st.wh / 1000) : 0,
      drive_phase: st.phase,
      lap: Math.floor(st.distance / RACE.lapLength) + 1,
      lap_distance: st.distance % RACE.lapLength,
      ...trackPosition(st.distance),
      gps_fix: true,
      injected_fault: fault?.id ?? null,
      km_per_kwh_complete: true,
      ...vehicleSignals(st.t, st.v, o, st.samples),
    }
    sample.alerts = evaluate(sample)
    return sample
  }
}
