import { has } from './format'

export const VLO = 12
export const VHI = 36

const EARTH_R = 6371000
const RECENT = 20

export function speedColor(ms) {
  const r = Math.min(1, Math.max(0, ((ms ?? 0) * 3.6 - VLO) / (VHI - VLO)))
  return `hsl(20, 100%, ${Math.round(18 + r * 42)}%)`
}

export function hasFix(p) {
  return !!p && has(p.lat) && has(p.lon) && p.gps_fix !== false
}

export function recentFix(series) {
  const tail = (series || []).slice(-RECENT)
  return tail.some(hasFix)
}

export function distanceM(a, b) {
  const k = Math.PI / 180
  const x = (b.lon - a.lon) * k * Math.cos(((a.lat + b.lat) / 2) * k)
  const y = (b.lat - a.lat) * k
  return Math.hypot(x, y) * EARTH_R
}

export function bearing(a, b) {
  const k = Math.PI / 180
  const x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * k)
  const y = b.lat - a.lat
  return (Math.atan2(x, y) * 180) / Math.PI
}

export function comma(v, digits = 1) {
  return has(v) ? Number(v).toFixed(digits).replace('.', ',') : '--'
}

export function gpsStatus(p) {
  const present = !!p && ['lat', 'lon', 'gps_fix', 'gps_sats', 'gps_hdop'].some((k) => p[k] !== undefined && p[k] !== null)
  if (!present) return { level: 'none', text: 'GPS --' }
  const sats = has(p.gps_sats) ? Number(p.gps_sats) : null
  const hdop = has(p.gps_hdop) ? Number(p.gps_hdop) : null
  const detail = [sats !== null ? `${sats} sat` : null, hdop !== null ? `HDOP ${comma(hdop, 1)}` : null].filter(Boolean).join(' · ')
  if (!hasFix(p)) return { level: 'nofix', text: `GPS sem fix${detail ? ` · ${detail}` : ''}` }
  const weak = (sats !== null && sats < 6) || (hdop !== null && hdop > 2)
  return { level: weak ? 'weak' : 'ok', text: `GPS ${detail || 'fix'}` }
}

export function speedDelta(p) {
  if (!hasFix(p) || !has(p.gps_speed) || !has(p.velocity)) return null
  return (Number(p.gps_speed) - Number(p.velocity)) * 3.6
}
