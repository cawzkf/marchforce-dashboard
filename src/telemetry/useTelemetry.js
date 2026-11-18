import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FAULT_MAX_S, FAULTS } from '../data/catalog'
import { rankedAlerts, sourceInfo } from '../lib/telemetry'
import { createDemoEngine, staleAlert } from './demoEngine'

const SERIES_STEP_S = 0.5
const SERIES_POINTS = 320
const MAX_FRAMES = 7200
const FLUSH_MS = 250
const STALE_S = 3
const DEMO_FAULT_KEY = 'mf-demo-fault'
const DEMO_DT = 0.1
const STATUS_POLL_MS = 1000
const NO_STATUS = { available: false, age_s: null, data: null }
const DEMO_RADIO = { rssi: -92, snr: 7.5 }

function emptyStore() {
  return { latest: null, series: [], receivedAt: null, startTs: null, events: [], active: new Set(), frames: [], frameAt: null, frameSession: null, lastSeq: 0 }
}

function ingest(store, sample) {
  if (store.latest && store.latest.session_id !== sample.session_id) {
    Object.assign(store, { ...emptyStore(), frames: store.frames, frameAt: store.frameAt, frameSession: store.frameSession, lastSeq: store.lastSeq })
  }
  store.latest = sample
  store.receivedAt = Date.now()
  store.startTs ??= sample.timestamp
  const last = store.series[store.series.length - 1]
  if (!last || sample.timestamp - last.timestamp >= SERIES_STEP_S) {
    store.series = [...store.series, sample].slice(-SERIES_POINTS)
  }
  const codes = new Set((sample.alerts ?? []).map((a) => a.code))
  const fresh = (sample.alerts ?? []).filter((a) => !store.active.has(a.code))
  store.active = codes
  if (fresh.length) {
    const events = fresh.map((a) => ({ ...a, at: sample.timestamp - store.startTs, sample }))
    store.events = [...events, ...store.events].slice(0, 30)
  }
}

function addFrames(store, frames, session, ageS, lastSeq) {
  if (lastSeq < store.lastSeq) {
    store.frames = []
    store.frameSession = null
    store.lastSeq = 0
    return
  }
  if (session !== store.frameSession) {
    store.frameSession = session
    store.frames = []
  }
  const known = store.frames[store.frames.length - 1]?.seq ?? 0
  store.frames = [...store.frames, ...frames.filter((f) => f.seq > known)].slice(-MAX_FRAMES)
  store.lastSeq = Math.max(store.lastSeq, lastSeq)
  if (ageS !== null) store.frameAt = Date.now() - ageS * 1000
}

const EMPTY_VIEW = { latest: null, series: [], events: [], frames: [], frameAge: null, age: null, elapsed: null }

function useFeed(connect, key) {
  const store = useRef(emptyStore())
  const [view, setView] = useState(EMPTY_VIEW)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    store.current = emptyStore()
    setView(EMPTY_VIEW)
    setConnected(false)
    const cleanup = connect({
      push: (sample) => ingest(store.current, sample),
      pushFrames: (frames, session, ageS, lastSeq) => addFrames(store.current, frames, session, ageS, lastSeq),
      lastSeq: () => store.current.lastSeq,
      setConnected,
    })
    const id = setInterval(() => {
      const s = store.current
      setView({
        latest: s.latest,
        series: s.series,
        events: s.events,
        frames: s.frames,
        frameAge: s.frameAt ? (Date.now() - s.frameAt) / 1000 : null,
        age: s.receivedAt ? (Date.now() - s.receivedAt) / 1000 : null,
        elapsed: s.latest ? s.latest.timestamp - s.startTs : null,
      })
    }, FLUSH_MS)
    return () => {
      clearInterval(id)
      cleanup()
    }
  }, [connect, key])

  return { ...view, connected }
}

function connectLive(source) {
  return ({ push, pushFrames, lastSeq, setConnected }) => {
    let closed = false
    let retry
    let ws
    const open = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const query = source === 'bench' ? '?source=bench' : ''
      ws = new WebSocket(`${proto}://${window.location.host}/ws/live${query}`)
      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!closed) retry = setTimeout(open, 1500)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (event) => push(JSON.parse(event.data))
    }
    open()
    const poll = async () => {
      if (source === 'bench') return
      try {
        const res = await fetch(`/api/lora/frames?after=${lastSeq()}`)
        if (!res.ok) return
        const data = await res.json()
        if (!closed) pushFrames(data.frames, data.session, data.age_s, data.last_seq)
      } catch {
        return
      }
    }
    poll()
    const framesTimer = setInterval(poll, 1000)
    return () => {
      closed = true
      clearTimeout(retry)
      clearInterval(framesTimer)
      ws.close()
    }
  }
}

function demoFrame(sample, seq) {
  return {
    seq,
    sid: sample.session_id,
    data_source: sample.data_source,
    t: sample.timestamp,
    velocity: sample.velocity,
    soc: sample.soc,
    vdc: sample.vdc,
    idc: sample.idc,
    lat: sample.gps_fix ? sample.lat : null,
    lon: sample.gps_fix ? sample.lon : null,
    lap: sample.lap,
    alert: rankedAlerts(sample)[0]?.code,
  }
}

function readDemoFault() {
  try {
    const value = JSON.parse(window.localStorage.getItem(DEMO_FAULT_KEY) || 'null')
    if (!value || (Date.now() - value.startedAt) / 1000 >= FAULT_MAX_S) return null
    return value
  } catch {
    return null
  }
}

function writeDemoFault(value) {
  try {
    if (value) window.localStorage.setItem(DEMO_FAULT_KEY, JSON.stringify(value))
    else window.localStorage.removeItem(DEMO_FAULT_KEY)
  } catch {
    return false
  }
  return true
}

function useDemoFault(enabled) {
  const memory = useRef(null)
  const [state, setState] = useState(null)
  const read = useCallback(() => readDemoFault() ?? (memory.current && (Date.now() - memory.current.startedAt) / 1000 < FAULT_MAX_S ? memory.current : null), [])

  useEffect(() => {
    if (!enabled) return undefined
    setState(read())
    const id = setInterval(() => setState(read()), 500)
    return () => clearInterval(id)
  }, [enabled, read])

  const start = useCallback(async (id) => {
    const value = { id, startedAt: Date.now() }
    memory.current = value
    writeDemoFault(value)
    setState(value)
  }, [])
  const clear = useCallback(async () => {
    memory.current = null
    writeDemoFault(null)
    setState(null)
  }, [])

  return {
    available: true,
    active: state?.id ?? null,
    elapsed: state ? (Date.now() - state.startedAt) / 1000 : null,
    error: null,
    start,
    clear,
    read,
  }
}

function useLiveFault(enabled) {
  const [state, setState] = useState({ available: false, case: null, elapsed_s: null })
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/fault')
      if (!res.ok) throw new Error(String(res.status))
      setState(await res.json())
      setError(null)
    } catch {
      setState({ available: false, case: null, elapsed_s: null })
      setError('API indisponível')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    refresh()
    const id = setInterval(refresh, 1000)
    return () => clearInterval(id)
  }, [enabled, refresh])

  const send = useCallback(async (method, body) => {
    try {
      const res = await fetch('/api/fault', {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      if (res.status === 409) setError('Disponível só com a fonte simulador')
      else if (!res.ok) setError('Comando recusado pela API')
      else {
        setState(await res.json())
        setError(null)
      }
    } catch {
      setError('API indisponível')
    }
  }, [])

  const start = useCallback((id) => send('POST', { case: id }), [send])
  const clear = useCallback(() => send('DELETE'), [send])

  return { available: state.available, active: state.case, elapsed: state.elapsed_s, error, start, clear }
}

function useBench(enabled) {
  const [state, setState] = useState({ online: false, seen: false, sensor_ok: false, device: null, age_s: null })
  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch('/api/bench')
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (!cancelled) setState(data)
      } catch {
        if (!cancelled) setState({ online: false, seen: false, sensor_ok: false, device: null, age_s: null })
      }
    }
    poll()
    const id = setInterval(poll, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled])
  return state
}

function useStatus(path, enabled) {
  const [state, setState] = useState(NO_STATUS)
  useEffect(() => {
    setState(NO_STATUS)
    if (!enabled) return undefined
    let cancelled = false
    const poll = async () => {
      try {
        const res = await fetch(path)
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        if (!cancelled) setState(data)
      } catch {
        if (!cancelled) setState(NO_STATUS)
      }
    }
    poll()
    const id = setInterval(poll, STATUS_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [path, enabled])
  return state
}

function demoLink(feed) {
  if (!feed.latest) return NO_STATUS
  const state = feed.age !== null && feed.age <= STALE_S ? 'ok' : 'lost'
  return { available: true, age_s: 0, data: { state, ...DEMO_RADIO, received: feed.frames.length, lost: 0, crc_errors: 0, loss_pct: 0 } }
}

function demoBus(feed) {
  if (!feed.latest || feed.age === null || feed.age > STALE_S) return NO_STATUS
  const node = { online: true, age_ms: feed.latest.bus_age_ms, errors: feed.latest.bus_errors }
  return { available: true, age_s: 0, data: { nodes: { acquisition: node, inverter: node, bms: node } } }
}

const NO_FAULT = { available: false, active: null, elapsed: null, error: 'Falha ao vivo só existe no simulador', start: async () => {}, clear: async () => {} }

export function useTelemetry(mode) {
  const demo = mode === 'demo'
  const bench = mode === 'bench'
  const liveFault = useLiveFault(mode === 'sim')
  const demoFault = useDemoFault(demo)
  const benchState = useBench(!demo)
  const liveLink = useStatus('/api/lora/link', mode === 'sim')
  const liveBus = useStatus('/api/bus/health', mode === 'sim')
  const readFault = demoFault.read
  const [playback, setPlayback] = useState({ paused: false, speed: 1 })
  const playbackRef = useRef(playback)
  playbackRef.current = playback

  const connect = useMemo(() => {
    if (!demo) return connectLive(bench ? 'bench' : 'sim')
    return ({ push, pushFrames, setConnected }) => {
      const step = createDemoEngine()
      let last = null
      let silentSince = null
      let reported = false
      let frameTs = 0
      let seq = 0
      setConnected(true)
      const id = setInterval(() => {
        const { paused, speed } = playbackRef.current
        if (paused) return
        const value = readFault()
        const fault = value ? { id: value.id, elapsed: (Date.now() - value.startedAt) / 1000 } : null
        let sample = null
        for (let i = 0; i < speed; i += 1) sample = step(DEMO_DT, fault)
        if (fault?.id === 'telemetry_loss') {
          silentSince ??= Date.now()
          const silence = (Date.now() - silentSince) / 1000
          if (last && !reported && silence >= STALE_S) {
            reported = true
            push({ ...last, injected_fault: fault.id, alerts: [...last.alerts, staleAlert(silence)] })
          }
          return
        }
        silentSince = null
        reported = false
        last = sample
        push(sample)
        if (sample.timestamp - frameTs >= 1) {
          frameTs = sample.timestamp
          seq += 1
          pushFrames([demoFrame(sample, seq)], sample.session_id, 0, seq)
        }
      }, DEMO_DT * 1000)
      return () => clearInterval(id)
    }
  }, [demo, bench, readFault])

  const feed = useFeed(connect, mode)
  const fault = demo ? demoFault : bench ? NO_FAULT : liveFault
  const stale = feed.age !== null && (feed.age > STALE_S || feed.latest?.alerts?.some((a) => a.code === 'E-COMM-STALE'))
  const injected = bench ? null : fault.active ?? feed.latest?.injected_fault ?? null

  const source = sourceInfo(feed.latest?.data_source)
  const link = demo ? demoLink(feed) : liveLink
  const busHealth = demo ? demoBus(feed) : liveBus

  return { ...feed, mode, demo, bench, benchState, fault, stale, injected, faults: FAULTS, playback, setPlayback, link, busHealth, source }
}
