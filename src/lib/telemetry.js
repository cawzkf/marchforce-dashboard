import { ALERT_BY_CODE, FAULTS, LIMITS } from '../data/catalog'

export const NA = '--'
export const has = (v) => v !== null && v !== undefined && Number.isFinite(Number(v))
export const br = (v, digits = 1) => (has(v)
  ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  : NA)
export const kmh = (ms) => (has(ms) ? Number(ms) * 3.6 : null)

export function clock(seconds) {
  if (!has(seconds)) return NA
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function rankedAlerts(sample) {
  const list = sample?.alerts ?? []
  const rank = (a) => (a.severity === 'error' ? 0 : a.severity === 'warning' ? 1 : 2)
  return [...list].sort((a, b) => rank(a) - rank(b))
}

export const describe = (alert) => (alert ? ALERT_BY_CODE[alert.code] ?? null : null)
export const faultInfo = (id) => FAULTS.find((f) => f.id === id) ?? null

export function pilotCommand(sample, stale) {
  if (!sample || stale) return { title: 'SEM DADOS', note: 'mantenha o ritmo', tone: 'alert' }
  const order = rankedAlerts(sample).map(describe).find((d) => d?.pilot)
  if (order) return { title: order.pilot, note: order.pilotNote, tone: 'alert' }
  if (sample.data_source === 'bench') return { title: 'BANCADA', note: 'velocidade indisponível', tone: 'coast' }
  if (sample.inv_state === 'precharge') return { title: 'AGUARDE', note: 'pré-carga', tone: 'coast' }
  if (sample.inv_state === 'wait_dead_man') return { title: 'SEGURE O HOMEM-MORTO', note: 'no volante', tone: 'coast' }
  if (sample.drive_phase === 'burn') return { title: 'ACELERE', note: 'até 33 km/h', tone: 'burn' }
  if (sample.drive_phase === 'coast') return { title: 'SOLTE', note: 'religar em 16 km/h', tone: 'coast' }
  return { title: 'AGUARDE', note: 'largada', tone: 'coast' }
}

export function mechanicState(sample, stale) {
  if (!sample || stale) {
    return { step: 'TELEMETRIA', title: 'SEM DADOS', note: 'Conferir rede e computador de bordo.', tone: 'alert' }
  }
  const top = rankedAlerts(sample).find((a) => describe(a)?.mechanic !== 'Sem ação')
  const info = describe(top)
  if (info) {
    const estop = info.mechanic.startsWith('Apertar o E-STOP')
    return {
      step: `AO PARAR O CARRO · ${top.code}`,
      title: estop ? 'APERTE O E-STOP' : 'VERIFIQUE',
      note: estop ? 'A tela vai apagar. Siga o procedimento no box.' : `${info.mechanic}.`,
      tone: 'alert',
    }
  }
  if (sample.data_source === 'bench') return { step: 'SESSÃO SEPARADA', title: 'BANCADA', note: 'Medindo tensão e corrente.', tone: 'plain' }
  if (sample.inv_state === 'precharge') return { step: 'PASSO 1 DE 3', title: 'AGUARDE', note: 'Pré-carga em curso.', tone: 'plain' }
  if (sample.inv_state === 'wait_dead_man') return { step: 'PASSO 2 DE 3', title: 'PEÇA O HOMEM-MORTO', note: 'O piloto segura o comando no volante.', tone: 'plain' }
  if (sample.inv_state === 'ready') return { step: 'PASSO 3 DE 3', title: 'PODE LARGAR', note: 'Cadeia fechada e sem alertas.', tone: 'go' }
  if (Number(sample.velocity) > 0.5) return { step: 'CARRO EM MOVIMENTO', title: 'EM PROVA', note: 'Sem alertas ativos.', tone: 'plain' }
  return { step: 'CARRO PARADO', title: 'PODE LARGAR', note: 'Sem alertas ativos.', tone: 'go' }
}

const UNAVAILABLE = 'indisponível'
const LINK_STATES = { ok: 'recebendo', lost: 'sinal perdido', waiting: 'aguardando quadros' }
const BUS_NODES = [['acquisition', 'Nó 1 · aquisição'], ['inverter', 'Nó 2 · inversor'], ['bms', 'Nó 3 · BMS']]
const withUnit = (value, digits, unit) => (has(value) ? `${br(value, digits)} ${unit}` : UNAVAILABLE)

export function linkRows(status) {
  const d = status?.available ? status.data : null
  return [
    ['Estado', LINK_STATES[d?.state] ?? UNAVAILABLE],
    ['RSSI', withUnit(d?.rssi, 1, 'dBm')],
    ['SNR', withUnit(d?.snr, 1, 'dB')],
    ['Quadros perdidos', has(d?.lost) ? `${d.lost} (${br(d.loss_pct)} %)` : UNAVAILABLE],
    ['Erros de CRC', has(d?.crc_errors) ? String(d.crc_errors) : UNAVAILABLE],
  ]
}

export function nodeRows(status) {
  const nodes = status?.available ? status.data?.nodes : null
  return BUS_NODES.map(([id, label]) => {
    const n = nodes?.[id]
    if (!n) return [label, UNAVAILABLE]
    const age = has(n.age_ms) ? `${br(n.age_ms, 0)} ms` : 'sem resposta'
    return [label, `${n.online ? 'online' : 'offline'} · ${age} · ${n.errors} erros`]
  })
}

export function boxState(frame, frameAge, bench) {
  if (bench) return { title: 'SEM SINAL', note: 'A bancada não transmite por LoRa.', tone: 'lost' }
  if (!frame || frameAge === null || frameAge > 3) {
    return { title: 'SEM SINAL', note: 'Confirmar o carro na pista. Os valores são do último quadro.', tone: 'lost' }
  }
  const info = frame.alert ? ALERT_BY_CODE[frame.alert] : null
  if (info) {
    const prepare = info.severity === 'error' || info.pilot === 'VÁ AO BOX'
    return { title: prepare ? 'PREPARE A ENTRADA' : 'ACOMPANHE', note: `${info.box}.`, tone: prepare ? 'alert' : 'plain', code: frame.alert }
  }
  return { title: 'ACOMPANHE', note: 'Enlace ativo e nenhum alerta recebido.', tone: 'plain' }
}

export const signalValue = (sample, key) => {
  if (!sample) return null
  if (key === 'soc') return has(sample.soc) ? sample.soc * 100 : null
  if (key === 'velocity') return kmh(sample.velocity)
  return has(sample[key]) ? Number(sample[key]) : null
}

export function trend(series, key, seconds = 10) {
  const points = series.filter((p) => signalValue(p, key) !== null)
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const first = points.find((p) => last.timestamp - p.timestamp <= seconds) ?? points[0]
  const dt = last.timestamp - first.timestamp
  if (dt < 2) return null
  return (signalValue(last, key) - signalValue(first, key)) / dt
}

export function secondsToLimit(series, key) {
  const limit = LIMITS[key]
  if (!limit) return null
  const rate = trend(series, key)
  const value = signalValue(series[series.length - 1], key)
  if (!has(rate) || !has(value) || rate === 0) return null
  const left = (limit.crit - value) / rate
  return left > 0 ? left : null
}

export function levelOf(key, value) {
  const limit = LIMITS[key]
  if (!limit || !has(value)) return 'none'
  if (limit.falling) return value <= limit.crit ? 'crit' : value <= limit.warn ? 'warn' : 'ok'
  return value >= limit.crit ? 'crit' : value >= limit.warn ? 'warn' : 'ok'
}
