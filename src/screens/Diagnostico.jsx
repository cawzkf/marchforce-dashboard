import { LIMITS, procedureFor } from '../data/catalog'
import { br, clock, faultInfo, has, kmh, levelOf, secondsToLimit, signalValue, trend } from '../lib/telemetry'
import { Chart, HealthStrip, Panel, Stat, topAlert } from '../ui/kit'

const WINDOW_S = 90
const SIGNAL_META = {
  motor_temp: { title: 'Temperatura do motor: medida e modelo', unit: '°C', y: [20, 125] },
  battery_temp: { title: 'Temperatura da bateria', unit: '°C', y: [20, 70] },
  controller_temp: { title: 'Temperatura do inversor', unit: '°C', y: [20, 100] },
  idc: { title: 'Corrente no barramento', unit: 'A', y: [0, 16] },
  vdc: { title: 'Tensão no barramento', unit: 'V', y: [30, 60] },
  soc: { title: 'Estado de carga', unit: '%', y: [0, 100] },
  velocity: { title: 'Velocidade', unit: 'km/h', y: [0, 50] },
}
const LEVEL_TEXT = { ok: 'normal', warn: 'aviso', crit: 'corte', none: 'indisponível' }

function AlertCard({ t, current }) {
  const { alert, info } = current
  const key = info?.signal
  const limit = LIMITS[key]
  const value = key ? signalValue(t.latest, key) : null
  const meta = SIGNAL_META[key]
  const rate = key ? trend(t.series, key) : null
  const left = key ? secondsToLimit(t.series, key) : null
  const event = t.events.find((e) => e.code === alert.code)
  return (
    <section className="panel fault-card">
      <div className="row-between">
        <span className={`code-tag ${alert.severity}`}>{alert.code}</span>
        <span className="small">Ativo desde {clock(event?.at)}</span>
      </div>
      <h2 className="fault-title">{info?.message ?? alert.message}</h2>
      <div className="fault-value">
        <strong>{key ? br(value) : br(t.age, 0)}</strong><small>{key ? meta.unit : 's sem amostra'}</small>
      </div>
      <div className="stats-row">
        <Stat label="Aviso" value={limit ? br(limit.warn, limit.warn % 1 ? 1 : 0) : '--'} unit={limit?.unit} />
        <Stat label="Corte" value={limit ? br(limit.crit, limit.crit % 1 ? 1 : 0) : '--'} unit={limit?.unit} />
        <Stat label="Taxa" value={has(rate) ? br(rate * 60) : '--'} unit={meta ? `${meta.unit}/min` : ''} />
        <Stat label="Até o corte" value={has(left) ? br(left / 60) : '--'} unit="min" />
      </div>
      <div className="action-box">
        <span>Ação</span>
        <strong>Piloto: {info?.pilot ?? 'sem ação'}{info?.pilotNote ? `, ${info.pilotNote}` : ''}.</strong>
        <strong>Box: {info?.box}.</strong>
      </div>
    </section>
  )
}

function SignalChart({ t, signal, event }) {
  const meta = SIGNAL_META[signal]
  const limit = LIMITS[signal]
  const now = t.latest.timestamp
  const points = t.series.filter((p) => signalValue(p, signal) !== null).map((p) => [p.timestamp, signalValue(p, signal)])
  const model = signal === 'motor_temp' ? t.series.filter((p) => has(p.motor_temp_model)).map((p) => [p.timestamp, p.motor_temp_model]) : []
  const left = secondsToLimit(t.series, signal)
  const value = signalValue(t.latest, signal)
  const projection = has(left) && limit ? [[now, value], [now + left, limit.crit]] : []
  const horizon = Math.max(now + 25, has(left) ? Math.min(now + left + 5, now + 60) : 0)
  const grids = limit ? [[limit.warn, `${String(limit.warn).replace('.', ',')} aviso`, 'warn'], [limit.crit, `${String(limit.crit).replace('.', ',')} corte`, 'crit']] : []
  return (
    <Panel title={meta.title} note="Últimos 90 s" className="diag-chart">
      <Chart height={306} label={meta.title} left={78} x={[horizon - WINDOW_S, horizon]} y={meta.y} grids={grids}
        vlines={event ? [[event.sample.timestamp, `Alerta ${clock(event.at)}`, 'crit']] : []}
        lines={[{ name: 'medida', points, tone: 'thick' }, { name: 'modelo', points: model, tone: 'soft', dash: true }, { name: 'projecao', points: projection, tone: 'crit', dash: true }]}
        dots={[[now, value, 'crit']]} xLabels={[[horizon - WINDOW_S, '90 s'], [now, 'agora']]} />
      <div className="legend">
        <span>Linha cheia: medida</span>
        {model.length > 0 && <span className="muted">Tracejada cinza: gêmeo digital, {br(t.latest.motor_temp_model)} °C</span>}
        {projection.length > 0 && <span className="accent">Tracejada laranja: projeção</span>}
        {model.length > 0 && <strong>Desvio atual: {br(t.latest.motor_temp - t.latest.motor_temp_model)} K</strong>}
      </div>
    </Panel>
  )
}

function Snapshot({ event }) {
  const s = event?.sample
  const rows = s ? [
    ['Fase', { burn: 'Motor ligado', coast: 'Roda livre', idle: 'Parado' }[s.drive_phase] ?? 'indisponível'],
    ['Velocidade', `${br(kmh(s.velocity))} km/h`], ['Rotação', `${br(s.motor_rpm, 0)} rpm`],
    ['Torque (modelo)', `${br(s.motor_torque, 2)} N·m`], ['Barramento', `${br(s.vdc)} V · ${br(s.idc, 2)} A`],
    ['Potência', `${br(s.electrical_power, 0)} W`], ['Motor', `${br(s.motor_temp)} °C`],
    ['Inversor', `${br(s.controller_temp)} °C`], ['Bateria', `${br(s.battery_temp)} °C`],
  ] : []
  return (
    <Panel title="Instantâneo no alerta" note={event ? `${clock(event.at)}${s.lap ? ` · volta ${s.lap}` : ''}` : ''}>
      <div className="kv">{rows.map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>
    </Panel>
  )
}

function Evidence({ t, current }) {
  const s = t.latest
  const rows = [
    ['idc', 'Corrente DC', Math.abs(s.idc), 'A', '10 A aviso'],
    ['vdc', 'Tensão DC', s.vdc, 'V', '45 V aviso'],
    ['battery_temp', 'Bateria', s.battery_temp, '°C', '45 °C aviso'],
    ['controller_temp', 'Inversor', s.controller_temp, '°C', '70 °C aviso'],
  ]
  const residual = s.motor_temp - s.motor_temp_model
  const flagged = rows.filter(([key, , v]) => ['warn', 'crit'].includes(levelOf(key, v))).length
  const motorAlert = current.info?.signal === 'motor_temp'
  let conclusion = `${current.info?.message ?? current.alert.code}.`
  if (motorAlert && flagged === 0) conclusion = 'Corrente, tensão e demais temperaturas estão normais. Conferir a leitura da sonda e a dissipação do motor.'
  if (current.alert.code === 'E-COMM-STALE') conclusion = 'A API não recebe amostras. Os valores são da última amostra recebida.'
  return (
    <Panel title="Evidências" note="Medido e referência">
      <table className="table">
        <thead><tr><th>Sinal</th><th>Medido</th><th>Referência</th><th>Leitura</th></tr></thead>
        <tbody>
          {rows.map(([key, name, v, unit, ref]) => {
            const level = levelOf(key, v)
            return <tr key={key}><td>{name}</td><td>{br(v, unit === 'A' ? 2 : 1)} {unit}</td><td>{ref}</td><td className={['warn', 'crit'].includes(level) ? 'accent strong' : ''}>{LEVEL_TEXT[level]}</td></tr>
          })}
          <tr><td>Motor</td><td>{br(s.motor_temp)} °C</td><td>{br(s.motor_temp_model)} °C (modelo)</td><td className={Math.abs(residual) > 10 ? 'accent strong' : ''}>{residual >= 0 ? '+' : ''}{br(residual)} K</td></tr>
        </tbody>
      </table>
      <h3>Conclusão</h3>
      <p>{conclusion}</p>
    </Panel>
  )
}

function Procedure({ info }) {
  return (
    <Panel title="Procedimento no box" note="Proposta a validar pela equipe">
      <ol className="steps-list">{procedureFor(info).map((step) => <li key={step}>{step}</li>)}</ol>
    </Panel>
  )
}

function Events({ t }) {
  return (
    <Panel title="Alertas da sessão" note={`${t.events.length} registrados`}>
      {t.events.length === 0 ? <p className="muted">Nenhum alerta registrado nesta sessão.</p> : (
        <table className="table">
          <thead><tr><th>Tempo</th><th>Código</th><th>Descrição</th><th>Valor</th></tr></thead>
          <tbody>{t.events.map((e) => <tr key={`${e.code}-${e.at}`}><td>{clock(e.at)}</td><td>{e.code}</td><td>{e.message}</td><td>{br(e.value)}</td></tr>)}</tbody>
        </table>
      )}
    </Panel>
  )
}

export default function Diagnostico({ t }) {
  const current = topAlert(t.latest)
  const fault = faultInfo(t.injected)
  const signal = current?.info?.signal ?? fault?.signal
  const event = current ? t.events.find((e) => e.code === current.alert.code) : null
  return (
    <div className="stack">
      <HealthStrip t={t} />
      {!t.latest && <Panel title="Diagnóstico"><p className="muted">Aguardando amostras.</p></Panel>}
      {t.latest && !current && (
        <div className="diag-top">
          <Panel title="Diagnóstico" note="Sem alerta ativo"><p className="empty-title">Nenhum alerta ativo</p><p className="muted">{fault ? `${fault.label}: aguardando o primeiro limite.` : 'Todos os sinais estão dentro dos limites.'}</p></Panel>
          <SignalChart t={t} signal={signal ?? (t.bench ? 'idc' : 'motor_temp')} />
        </div>
      )}
      {current && (
        <div className="diag-top">
          <AlertCard t={t} current={current} />
          {signal ? <SignalChart t={t} signal={signal} event={event} /> : <Panel title="Telemetria" note="Sem amostras novas"><p className="empty-title">{br(t.age, 0)} s sem amostra</p><p className="muted">Último dado recebido em {clock(t.elapsed)} da sessão.</p></Panel>}
        </div>
      )}
      {current && (
        <div className="diag-bottom">
          <Snapshot event={event} />
          <Evidence t={t} current={current} />
          <Procedure info={current.info} />
        </div>
      )}
      <Events t={t} />
    </div>
  )
}
