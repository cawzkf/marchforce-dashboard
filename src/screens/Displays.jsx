import { useState } from 'react'
import { LIMITS, RACE } from '../data/catalog'
import track from '../data/track.json'
import { boxState, br, clock, describe, faultInfo, has, kmh, linkRows, mechanicState, pilotCommand, rankedAlerts, signalValue } from '../lib/telemetry'
import { Chart, Fit, Panel, SimTag } from '../ui/kit'

export function PilotDisplay({ t }) {
  const s = t.latest
  const cmd = pilotCommand(s, t.stale)
  const speed = t.stale ? null : kmh(s?.velocity)
  const info = rankedAlerts(s).map(describe).find((d) => d?.signal && LIMITS[d.signal])
  const alertTop = cmd.tone === 'alert'
  const position = Math.min(100, ((speed ?? 0) / 40) * 100)
  return (
    <div className="pilot">
      <div className={`pilot-top ${alertTop ? 'alert' : ''}`}>
        <span>{alertTop ? 'ALERTA' : `Volta ${Math.min(s?.lap ?? 1, RACE.laps)}/${RACE.laps}`}</span>
        <span>{clock(t.elapsed)} de 25:00</span>
        <span className="pilot-tag">{t.injected ? 'FALHA INJETADA' : t.bench ? 'BANCADA' : 'SIMULADO'}</span>
      </div>
      <div className="pilot-main">
        <div className="pilot-speed"><strong>{speed === null ? '--' : Math.round(speed)}</strong><span>km/h</span></div>
        <div className={`pilot-command ${cmd.tone}`}><strong>{cmd.title}</strong><span>{cmd.note}</span></div>
      </div>
      <div className="pilot-range">
        <div><i /><b style={{ left: `${position}%` }} /></div>
        {[[0, '0'], [40, '16'], [82.5, '33'], [100, '40']].map(([left, label]) => <span key={label} style={{ left: `${left}%` }}>{label}</span>)}
      </div>
      <div className="pilot-stats">
        <div><span>Energia</span><strong>{br(s?.energy_wh)} Wh</strong></div>
        <div><span>Bateria</span><strong>{br((s?.soc ?? NaN) * 100, 0)} %</strong></div>
        {info
          ? <div><span>{LIMITS[info.signal].label}</span><strong>{br(signalValue(s, info.signal), 0)} {LIMITS[info.signal].unit}</strong></div>
          : <div><span>km/kWh parcial</span><strong>{s?.km_per_kwh_complete !== false && s?.km_per_kwh > 0 ? br(s.km_per_kwh, 0) : '--'}</strong></div>}
      </div>
    </div>
  )
}

export function MechanicDisplay({ t }) {
  const s = t.latest
  const state = mechanicState(s, t.stale)
  return (
    <div className={`mechanic ${state.tone}`}>
      <div className="mechanic-step"><span>{state.step}</span><span>{t.injected ? 'FALHA INJETADA' : t.bench ? 'BANCADA' : 'SIMULADO'}</span></div>
      <div className="mechanic-order"><strong className={state.title.length > 12 ? 'long' : ''}>{state.title}</strong><span>{state.note}</span></div>
      <div className="mechanic-values">
        <div><span>Tensão DC</span><strong>{br(s?.vdc)} V</strong></div>
        <div><span>Motor</span><strong>{br(s?.motor_temp)} °C</strong></div>
        <div><span>Inversor</span><strong>{br(s?.controller_temp)} °C</strong></div>
      </div>
    </div>
  )
}

const MAP = { width: 680, height: 470, pad: 30 }
const hasPosition = (f) => has(f?.lat) && has(f?.lon)

function projector() {
  const lat0 = track.points[0][0]
  const k = Math.cos((lat0 * Math.PI) / 180)
  const xs = track.points.map(([, lon]) => lon * k)
  const ys = track.points.map(([lat]) => lat)
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const scale = Math.min((MAP.width - 2 * MAP.pad) / (maxX - minX), (MAP.height - 2 * MAP.pad) / (maxY - minY))
  const ox = (MAP.width - (maxX - minX) * scale) / 2
  const oy = (MAP.height - (maxY - minY) * scale) / 2
  return (lat, lon) => [ox + (lon * k - minX) * scale, MAP.height - oy - (lat - minY) * scale]
}

const project = projector()
const TRACK_POINTS = track.points.map(([lat, lon]) => project(lat, lon).map((v) => v.toFixed(1)).join(',')).join(' ')

function BoxMap({ frames, selected, onSelect, lost }) {
  const located = frames.filter(hasPosition)
  const last = frames[frames.length - 1]
  const car = hasPosition(last) ? project(last.lat, last.lon) : null
  const trail = located.slice(-900).map((f) => ({ f, p: project(f.lat, f.lon) }))
  const mark = selected && hasPosition(selected) ? project(selected.lat, selected.lon) : null
  const onClick = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * MAP.width
    const y = ((event.clientY - box.top) / box.height) * MAP.height
    let best = null
    let distance = 24
    trail.forEach(({ f, p }) => {
      const d = Math.hypot(p[0] - x, p[1] - y)
      if (d <= distance) {
        distance = d
        best = f
      }
    })
    if (best) onSelect(best.seq)
  }
  return (
    <section className="box-map">
      <div className="row-between"><h2>Pista do Píer Mauá</h2><span className={car ? 'muted' : 'accent strong'}>{car ? `Volta ${last.lap}` : 'sem posição'}</span></div>
      <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} role="img" aria-label="Mapa da pista com o trajeto recebido" onClick={onClick}>
        <polygon className="map-track" points={TRACK_POINTS} />
        <polyline className="map-trail" points={trail.map(({ p }) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} />
        {trail.filter((_, i) => i % 5 === 0).map(({ f, p }) => <circle key={f.seq} className="map-point" cx={p[0]} cy={p[1]} r="3.5" />)}
        {mark && <circle className="map-selected" cx={mark[0]} cy={mark[1]} r="11" />}
        {car && <circle className={`map-car ${lost ? 'lost' : ''}`} cx={car[0]} cy={car[1]} r="10" />}
      </svg>
    </section>
  )
}

function FrameDetails({ frame }) {
  const rows = frame ? [
    ['Horário', new Date(frame.t * 1000).toLocaleTimeString('pt-BR', { hour12: false })], ['Volta', frame.lap ?? 'indisponível'],
    ['Velocidade', `${br(kmh(frame.velocity))} km/h`], ['Potência', `${br(frame.vdc * frame.idc, 0)} W`],
    ['Tensão', `${br(frame.vdc)} V`], ['Corrente', `${br(frame.idc, 2)} A`],
    ['Bateria', `${br(frame.soc * 100)} %`], ['Alerta', frame.alert ?? 'nenhum'],
  ] : []
  return (
    <section className="box-point">
      <h2>Ponto selecionado</h2>
      {frame ? <div className="kv two">{rows.map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div> : <p className="muted">Clique em um ponto do trajeto.</p>}
    </section>
  )
}

function LinkStatus({ status }) {
  return (
    <section className="box-link">
      <h2>Enlace LoRa</h2>
      <div className="kv">{linkRows(status).map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>
    </section>
  )
}

export function BoxDisplay({ t }) {
  const [selectedSeq, setSelectedSeq] = useState(null)
  const frames = t.frames
  const f = frames[frames.length - 1]
  const state = boxState(f, t.frameAge, t.bench)
  const lost = state.tone === 'lost'
  const selected = frames.find((x) => x.seq === selectedSeq) ?? null
  const now = f?.t ?? 0
  const points = frames.slice(-145).map((p) => [p.t, kmh(p.velocity)])
  const cards = [
    ['Velocidade', br(kmh(f?.velocity)), 'km/h'], ['Potência elétrica', f ? br(f.vdc * f.idc, 0) : '--', 'W'], ['Bateria', br((f?.soc ?? NaN) * 100), '%'],
    ['Tensão DC', br(f?.vdc), 'V'], ['Corrente DC', br(f?.idc, 2), 'A'], ['Último quadro', br(t.frameAge), 's'],
  ]
  return (
    <div className="box-screen">
      <header><div className="brand"><img src="/logo-mark.png" alt="" /><strong>MACHFORCE</strong><span>Box · rádio LoRa 915 MHz · 1 quadro por segundo · {frames.length} quadros na sessão</span></div><div className="box-tags">{t.injected && <span className="injected-tag">FALHA INJETADA</span>}<SimTag bench={t.bench} /></div></header>
      <main>
        <section className={`box-action ${state.tone}`}><span>AÇÃO</span><strong>{state.title}</strong><p>{state.note}</p></section>
        <BoxMap frames={frames} selected={selected} onSelect={setSelectedSeq} lost={lost} />
        <section className="box-cards">
          {cards.map(([label, value, unit]) => <div key={label} className={lost && label !== 'Último quadro' ? 'stale' : ''}><span>{label}</span><strong>{value}<small> {unit}</small></strong></div>)}
        </section>
      </main>
      <footer>
        <section><h2>Velocidade recebida pelo rádio</h2><Chart height={240} label="Velocidade recebida" x={[now - 145, now]} y={[0, 40]} grids={[[16, '16'], [33, '33']]} lines={[{ name: 'v', points }]} xLabels={[[now - 145, '145 s atrás'], [now - 8, 'agora']]} /></section>
        <FrameDetails frame={selected} />
        <LinkStatus status={t.link} />
        <section className="box-last"><span>Último alerta recebido</span><strong className={state.code ? 'accent' : ''}>{state.code ?? (lost ? 'Sem dados novos' : 'Nenhum alerta')}</strong></section>
      </footer>
      <p className="muted">{t.bench ? 'Sessão de bancada.' : 'Dados simulados.'} O rádio só transmite do carro para o box.</p>
    </div>
  )
}

const FullFrames = { piloto: [PilotDisplay, 800, 480], mecanica: [MechanicDisplay, 480, 320], box: [BoxDisplay, 1920, 1080] }

export function FullDisplay({ name, t }) {
  const [Component, w, h] = FullFrames[name]
  return <div className="full-display"><Fit w={w} h={h}><Component t={t} /></Fit></div>
}

export function Displays({ t, href }) {
  const fault = faultInfo(t.injected)
  return (
    <div className="stack">
      <div className="page-title"><h1>Displays</h1><p className="muted">{fault ? `Falha injetada: ${fault.label}.` : 'Telas do piloto, da mecânica e do box com os dados atuais.'}</p></div>
      <div className="display-grid">
        <Panel title="Piloto · 800×480" actions={<a className="btn" href={href('/piloto')} target="_blank" rel="noreferrer">Abrir em tela própria</a>}>
          <div className="frame" style={{ aspectRatio: '800 / 480' }}><Fit w={800} h={480}><PilotDisplay t={t} /></Fit></div>
        </Panel>
        <Panel title="Mecânica · 480×320" actions={<a className="btn" href={href('/mecanica')} target="_blank" rel="noreferrer">Abrir em tela própria</a>}>
          <div className="frame" style={{ aspectRatio: '480 / 320' }}><Fit w={480} h={320}><MechanicDisplay t={t} /></Fit></div>
        </Panel>
        <Panel title="Box · LoRa" actions={<a className="btn" href={href('/box')} target="_blank" rel="noreferrer">Abrir em tela própria</a>}>
          <div className="frame" style={{ aspectRatio: '1920 / 1080' }}><Fit w={1920} h={1080}><BoxDisplay t={t} /></Fit></div>
        </Panel>
      </div>
      <div className="display-notes">
        <Panel title="Sequência de partida" note="Simulada, hardware pendente">
          <ol className="steps-list">
            <li>Pré-carga: campo dc_link_on e estado precharge.</li>
            <li>Homem-morto: campo inv_inputs.dead_man.</li>
            <li>Liberação: estado ready, sem alertas.</li>
          </ol>
        </Panel>
        <Panel title="Etiqueta da carenagem" note="Tela apagada">
          <ol className="steps-list">
            <li>Gire e solte os dois E-STOP.</li><li>Ligue a chave geral.</li><li>Ligue a ignição.</li><li>Se não acender, confira BMS e fusível.</li>
          </ol>
        </Panel>
      </div>
    </div>
  )
}
