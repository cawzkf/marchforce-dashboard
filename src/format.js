export const NA = '--'

export function has(v) {
  return v !== null && v !== undefined && Number.isFinite(Number(v))
}

export function num(v, digits = 1, scale = 1) {
  return has(v) ? (Number(v) * scale).toFixed(digits) : NA
}

export function kmh(ms) {
  return has(ms) ? Number(ms) * 3.6 : null
}

export function clock(seconds) {
  if (!has(seconds)) return NA
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`
}

export const THERMAL = {
  battery_temp: { label: 'Bateria', warn: 45, crit: 60, max: 70 },
  motor_temp: { label: 'Motor', warn: 90, crit: 125, max: 140 },
  controller_temp: { label: 'Controlador', warn: 70, crit: 85, max: 100 },
  ambient_temp: { label: 'Ambiente', max: 50 },
}

export const LIMITS = {
  motorNominalW: 200,
  motorNominalRpm: 3610,
  motorMaxRpm: 4500,
  gearRatio: 9.31,
  burn: [30, 35],
  coast: [15, 18],
  speedMax: 45,
  powerMax: 400,
  cellMin: 2.5,
  cellMax: 3.65,
  cells: 16,
}

export function levelOf(value, warn, crit) {
  if (!has(value) || warn === undefined) return 'none'
  if (crit !== undefined && value >= crit) return 'crit'
  if (value >= warn) return 'warn'
  return 'ok'
}

export const LEVEL_TEXT = { ok: 'OK', warn: 'ALERTA', crit: 'CRÍTICO', none: '' }

export const PHASES = {
  burn: { label: 'BURN', hint: 'Tração' },
  coast: { label: 'COAST', hint: 'Roda livre' },
  idle: { label: 'IDLE', hint: 'Parado' },
}
