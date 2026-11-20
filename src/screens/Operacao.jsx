import { EFFICIENCY_CASES, INVERTER_STATES, LIMITS, MOTOR, PACK, STRATEGIES, STRATEGY_MIN_M } from '../data/catalog'
import { br, describe, fieldLabel, has, kmh, rankedAlerts, speedMarks, strategyLabel, strategyMode } from '../lib/telemetry'
import { Bar, burnBands, cellPct, cellSpread, Chart, HealthStrip, Panel, Stat } from '../ui/kit'

const WINDOW_S = 145
const flag = (value, on, off) => (value === true ? on : value === false ? off : 'indisponível')
const inverterInputs = (s) => [
  ['Emergência', flag(s?.inv_inputs?.estop_closed, 'fechada', 'aberta')],
  ['BMS-OK', flag(s?.inv_inputs?.bms_ok, 'ativo', 'falha')],
  ['Homem-morto', flag(s?.inv_inputs?.dead_man, 'pressionado', 'solto')],
  ['Habilitação', flag(s?.inv_inputs?.enable, 'ativa', 'inativa')],
  ['Elo CC', flag(s?.dc_link_on, 'energizado', 'sem tensão')],
]

function Power({ s }) {
  const shaft = s ? (s.motor_torque * s.motor_rpm * 2 * Math.PI) / 60 : null
  const input = s?.electrical_power
  const losses = has(shaft) && has(input) ? input - shaft : null
  const phases = [['idle', 'Parado'], ['burn', 'Motor ligado'], ['coast', 'Roda livre']]
  return (
    <Panel title="Potência e segurança" note={`Inversor: ${INVERTER_STATES[s?.inv_state] ?? 'indisponível'}${s?.inv_fault ? ` (${s.inv_fault})` : ''}`} className="span-power">
      <div className="steps">{phases.map(([id, label]) => <span key={id} className={s?.drive_phase === id ? 'on' : ''}>{label}</span>)}</div>
      <div className="tiles">
        <Stat label={fieldLabel(s, 'Entrada DC', 'electrical_power')} value={br(input, 0)} unit="W" />
        <Stat label="No eixo (modelo)" value={br(shaft, 0)} unit="W" />
        <Stat label="Perdas (modelo)" value={br(losses, 0)} unit="W" />
        <Stat label="Eficiência (modelo)" value={input > 5 ? br((shaft / input) * 100) : '--'} unit="%" />
      </div>
      <div className="row-between"><h3>{fieldLabel(s, 'Corrente no barramento e proteções', 'idc')}</h3><strong className="value-lg">{br(s?.idc, 2)} A</strong></div>
      <div className="ladder">
        <Bar value={Math.abs(s?.idc ?? 0)} max={16} />
        {[[7, 'operação'], [10, 'inversor'], [12, 'BMS'], [15, 'fusível']].map(([a, name]) => (
          <span key={a} style={{ left: `${(a / 16) * 100}%` }}><b>{a} A</b>{name}</span>
        ))}
      </div>
      <h3>Entradas lidas pelo inversor</h3>
      <div className="inputs">{inverterInputs(s).map(([name, value]) => <div key={name}><span>{name}</span><em className={value === 'indisponível' ? '' : 'known'}>{value}</em></div>)}</div>
    </Panel>
  )
}

function OperatingPoint({ s }) {
  const running = s?.motor_rpm > 0 && s?.motor_torque > 0
  return (
    <Panel title="Ponto de operação do motor" note="Torque × rotação" className="span-motor">
      <Chart height={258} label="Ponto de operação do motor" x={[0, 4600]} y={[0, 1.4]} left={52}
        grids={[[MOTOR.nominalTorque, '0,627'], [0.75, '0,75'], [MOTOR.peakTorque, '1,217']]}
        vlines={[[MOTOR.rpm16, '16 km/h'], [MOTOR.rpm33, '33 km/h'], [MOTOR.noLoadRpm, null, 'warn']]}
        lines={[{ name: 'faixa', points: [[MOTOR.rpm16, 0.75], [MOTOR.rpm33, 0.75]], tone: 'thick' }]}
        dots={running ? [[s.motor_rpm, s.motor_torque]] : []}
        xLabels={[[0, '0'], [1000, '1.000'], [2000, '2.000'], [3000, '3.000 rpm']]} />
      <div className="stats-row">
        <Stat label={fieldLabel(s, 'Rotação', 'motor_rpm')} value={br(s?.motor_rpm, 0)} unit="rpm" />
        <Stat label="Torque (modelo)" value={br(s?.motor_torque, 2)} unit="N·m" />
        <Stat label="Rendimento (modelo)" value={br((s?.motor_efficiency ?? NaN) * 100)} unit="%" />
      </div>
      <p className="muted small">0,627 N·m é o torque nominal. 1,217 N·m é o limite por 11 A de fase. A linha laranja marca a rotação em vazio. Rotação zero indica roda livre.</p>
    </Panel>
  )
}

function Battery({ s }) {
  return (
    <Panel title="Bateria 15S e temperaturas" note="LiFePO4 · 6 Ah" className="span-battery">
      <div className="stats-row">
        <Stat label={fieldLabel(s, 'Estado de carga', 'soc')} value={br((s?.soc ?? NaN) * 100)} unit="%" />
        <Stat label={fieldLabel(s, 'Energia usada', 'energy_wh')} value={`${br(s?.energy_wh)} de ${PACK.energyWh}`} unit="Wh" />
        <Stat label={fieldLabel(s, 'Dispersão de células', 'cell_voltage_max')} value={br(cellSpread(s), 0)} unit="mV" />
      </div>
      <h3>{fieldLabel(s, 'Tensão de célula: mínima, média e máxima', 'cell_voltage_avg')}</h3>
      <div className="cell-scale">
        <div>{has(s?.cell_voltage_avg) && <><i style={{ left: cellPct(s.cell_voltage_min), right: `calc(100% - ${cellPct(s.cell_voltage_max)})` }} /><b style={{ left: cellPct(s.cell_voltage_avg) }} /></>}</div>
        <span>2,50 V</span>
        <strong>{br(s?.cell_voltage_min, 3)} / {br(s?.cell_voltage_avg, 3)} / {br(s?.cell_voltage_max, 3)} V</strong>
        <span>3,65 V</span>
      </div>
      <div className="temps">
        {['battery_temp', 'motor_temp', 'controller_temp'].map((key) => {
          const l = LIMITS[key]
          const scale = l.crit * 1.1
          return (
            <div key={key}>
              <span>{fieldLabel(s, l.label, key)}</span>
              <Bar value={s?.[key] ?? 0} max={scale} marks={[[l.warn, 'warn-mark'], [l.crit, 'crit-mark']]} />
              <strong>{br(s?.[key])} °C</strong>
              <small>aviso {l.warn} · corte {l.crit}</small>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function Playback({ t }) {
  if (!t.demo) return null
  const { paused, speed } = t.playback
  return (
    <div className="playback">
      <button type="button" className="btn solid" onClick={() => t.setPlayback({ paused: !paused, speed })}>{paused ? 'Continuar' : 'Pausar'}</button>
      <div className="seg">
        {[1, 4, 16].map((v) => <button type="button" key={v} className={speed === v ? 'on' : ''} onClick={() => t.setPlayback({ paused, speed: v })}>{v}×</button>)}
      </div>
    </div>
  )
}

function Trends({ t }) {
  const now = t.latest?.timestamp ?? 0
  const x = [now - WINDOW_S, now]
  const bands = burnBands(t.series)
  const marks = speedMarks(strategyMode(t.latest, t.strategy), t.strategy.targets)
  const speed = t.series.map((p) => [p.timestamp, kmh(p.velocity)])
  const power = t.series.map((p) => [p.timestamp, p.electrical_power])
  const labels = [[now - WINDOW_S, '145 s atrás'], [now - 72, '72 s'], [now - 10, 'agora']]
  return (
    <Panel title="Velocidade e potência" note="Janela de 145 s" actions={<Playback t={t} />} className="span-trends">
      <h3>{fieldLabel(t.latest, 'Velocidade', 'velocity')}</h3>
      <Chart height={150} label="Velocidade" x={x} y={[0, 40]} left={70} bands={bands} grids={marks}
        lines={[{ name: 'velocidade', points: speed }]} dots={[[now, kmh(t.latest?.velocity)]]} xLabels={labels} />
      <h3>{fieldLabel(t.latest, 'Potência elétrica no barramento', 'electrical_power')}</h3>
      <Chart height={128} label="Potência elétrica" x={x} y={[0, 620]} left={70} bands={bands} grids={[[200, '200'], [400, '400 W']]}
        lines={[{ name: 'potencia', points: power }]} dots={[[now, t.latest?.electrical_power]]} xLabels={labels} />
    </Panel>
  )
}

function AlertCodes({ alerts }) {
  return (
    <div className="alert-list">
      {alerts.length === 0 && <span>Nenhum alerta ativo</span>}
      {alerts.slice(0, 3).map((a) => <span key={a.code} className={a.severity}>{a.code}</span>)}
    </div>
  )
}

function strategyLine(s, mode, settling, targets) {
  if (settling) {
    const band = mode === 'cruise' ? `${br(targets.cruise_kmh, 0)} km/h` : `a faixa de ${br(targets.coast_kmh, 0)} a ${br(targets.burn_kmh, 0)} km/h`
    return `O carro está indo para ${band}. A medição começa quando a velocidade estabiliza.`
  }
  if (!has(s?.strategy_km_per_kwh)) return `Trecho com ${br(s?.strategy_distance, 0)} m. O valor aparece a partir de ${STRATEGY_MIN_M} m.`
  return mode === 'burn_coast' ? 'Conta só este trecho. Oscila com a fase do ciclo.' : 'Conta só este trecho, desde a troca de estratégia.'
}

function StrategyEfficiency({ t, alerts }) {
  const s = t.latest
  const { strategy } = t
  const mode = strategy.mode ?? s?.drive_strategy ?? 'burn_coast'
  const settling = s?.drive_strategy !== mode
  const other = STRATEGIES.find((x) => x.id !== mode) ?? STRATEGIES[0]
  const otherValue = s?.strategy_results?.[other.id]
  return (
    <>
      <div className="seg strategy-seg" role="group" aria-label="Estratégia de condução">
        {STRATEGIES.map((x) => (
          <button type="button" key={x.id} className={mode === x.id ? 'on' : ''} disabled={!strategy.available} title={x.note} onClick={() => strategy.select(x.id)}>{x.label}</button>
        ))}
      </div>
      {!strategy.available && strategy.error && <p className="small muted">{strategy.error}</p>}
      <div className="row-between strategy-values">
        <div className="strategy-main">
          <strong className="hero-number">{!settling && has(s?.strategy_km_per_kwh) ? br(s.strategy_km_per_kwh, 0) : '--'}</strong>
          <span className="muted small">km/kWh · {strategyLabel(mode)}</span>
        </div>
        <div className="stat strategy-other">
          <span className="muted small">{other.label}</span>
          <strong>{has(otherValue) ? br(otherValue, 0) : '--'}<small> km/kWh</small></strong>
          <span className="muted small">{has(otherValue) ? 'último trecho medido' : 'ainda sem trecho medido'}</span>
        </div>
      </div>
      <p className="small">{strategyLine(s, mode, settling, strategy.targets)}</p>
      <div className="row-between"><span className="muted small">Alertas ativos</span><AlertCodes alerts={alerts} /></div>
    </>
  )
}

function Efficiency({ t }) {
  const alerts = rankedAlerts(t.latest)
  const complete = t.latest?.km_per_kwh_complete !== false
  if (t.mode === 'sim' && (t.strategy.available || t.latest?.drive_strategy)) {
    return (
      <Panel title="Eficiência e alertas" note="km/kWh por estratégia" className="span-eff">
        <StrategyEfficiency t={t} alerts={alerts} />
        <p className="muted small">Referências do modelo. As condições são diferentes.</p>
        <div className="ref-list">
          {EFFICIENCY_CASES.map((c) => <div key={c.name}><span>{c.name}</span><strong>{c.short}</strong></div>)}
        </div>
        {alerts[0] && <p className="small">{describe(alerts[0])?.message}</p>}
      </Panel>
    )
  }
  return (
    <Panel title="Eficiência e alertas" note={fieldLabel(t.latest, 'km/kWh parcial', 'km_per_kwh')} className="span-eff">
      <div className="row-between">
        <strong className="hero-number">{complete && t.latest?.km_per_kwh > 0 ? br(t.latest.km_per_kwh, 0) : '--'}</strong>
        <AlertCodes alerts={alerts} />
      </div>
      <p className="small">{complete ? 'Oscila com a fase do ciclo até o fim da tentativa.' : 'Indisponível porque a sessão foi retomada em movimento ou perdeu amostras.'}</p>
      <p className="muted small">Referências do modelo. As condições são diferentes.</p>
      <div className="ref-list">
        {EFFICIENCY_CASES.map((c) => <div key={c.name}><span>{c.name}</span><strong>{c.short}</strong></div>)}
      </div>
      {alerts[0] && <p className="small">{describe(alerts[0])?.message}</p>}
    </Panel>
  )
}

export default function Operacao({ t }) {
  return (
    <div className="stack">
      <HealthStrip t={t} />
      <div className="ops-grid">
        <Power s={t.latest} />
        <OperatingPoint s={t.latest} />
        <Battery s={t.latest} />
        <Trends t={t} />
        <Efficiency t={t} />
      </div>
    </div>
  )
}
