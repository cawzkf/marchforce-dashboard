import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine,
} from 'recharts'
import { LIMITS, has } from '../format'

const INK = '#8c8c8c'
const GRID = '#1f1f1f'

const TRACES = [
  {
    id: 'speed', title: 'Velocidade', unit: 'km/h', domain: [0, LIMITS.speedMax],
    lines: [{ key: 'speed', name: 'Velocidade', color: '#ff5400' }],
    bands: [
      { y1: LIMITS.coast[0], y2: LIMITS.coast[1], cls: '#4cc3ff' },
      { y1: LIMITS.burn[0], y2: LIMITS.burn[1], cls: '#ff5400' },
    ],
  },
  {
    id: 'power', title: 'Potência', unit: 'W', domain: [0, 'auto'],
    lines: [
      { key: 'pElec', name: 'Elétrica', color: '#ff5400' },
      { key: 'pMech', name: 'Mecânica', color: '#f2f2f2' },
    ],
    ref: { y: LIMITS.motorNominalW, label: 'NOM 200 W' },
  },
  {
    id: 'temp', title: 'Temperaturas', unit: '°C', domain: ['auto', 'auto'],
    lines: [
      { key: 'motor_temp', name: 'Motor', color: '#ff5400' },
      { key: 'controller_temp', name: 'Controlador', color: '#f2f2f2' },
      { key: 'battery_temp', name: 'Bateria', color: '#4cc3ff' },
      { key: 'ambient_temp', name: 'Ambiente', color: '#8c8c8c', dash: '4 3' },
    ],
  },
  {
    id: 'idc', title: 'Corrente DC', unit: 'A', domain: [0, 'auto'],
    lines: [{ key: 'idc', name: 'Idc', color: '#ff5400' }],
  },
]

function burnSpans(data) {
  const spans = []
  let start = null
  data.forEach((p, i) => {
    const burning = p.phase === 'burn'
    if (burning && start === null) start = p.timestamp
    if ((!burning || i === data.length - 1) && start !== null) {
      spans.push([start, p.timestamp])
      start = null
    }
  })
  return spans
}

function Trace({ trace, data, spans, last, isLast }) {
  const rel = (ts) => `${(ts - last).toFixed(0)} s`
  const unitOf = trace.unit
  const present = trace.lines.filter((l) => data.some((p) => has(p[l.key])))

  return (
    <div className="trace">
      <div className="trace-head">
        <h3>{trace.title} <small>{unitOf}</small></h3>
        {trace.lines.length > 1 && (
          <div className="trace-legend">
            {trace.lines.map((l) => (
              <span key={l.key} className={present.includes(l) ? '' : 'absent'}>
                <i style={{ background: l.color }} className={l.dash ? 'dashed' : ''} />{l.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={isLast ? 128 : 104}>
        <LineChart data={data} syncId="logger" margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          {spans.map(([a, b]) => (
            <ReferenceArea key={a} x1={a} x2={b} fill="#ff5400" fillOpacity={0.07} strokeOpacity={0} ifOverflow="hidden" />
          ))}
          {trace.bands?.map((b) => (
            <ReferenceArea key={b.y1} y1={b.y1} y2={b.y2} fill={b.cls} fillOpacity={0.12} strokeOpacity={0} />
          ))}
          {trace.ref && (
            <ReferenceLine y={trace.ref.y} stroke="#ce4400" strokeDasharray="4 4"
                           label={{ value: trace.ref.label, fill: INK, fontSize: 10, position: 'insideTopRight' }} />
          )}
          <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={rel}
                 hide={!isLast} stroke={INK} fontSize={10} minTickGap={40} tickLine={false} />
          <YAxis domain={trace.domain} stroke={INK} fontSize={10} width={40} tickLine={false} axisLine={false}
                 allowDecimals={false} tickCount={4} />
          <Tooltip
            labelFormatter={rel}
            formatter={(v, name) => [has(v) ? `${Number(v).toFixed(1)} ${unitOf}` : '--', name]}
            contentStyle={{ background: '#0d0d0d', border: '1px solid #ff5400', borderRadius: 4, fontSize: 12 }}
            itemStyle={{ color: '#f2f2f2' }}
            labelStyle={{ color: INK }}
            cursor={{ stroke: '#ff5400', strokeWidth: 1 }}
            isAnimationActive={false}
          />
          {trace.lines.map((l) => (
            <Line key={l.key} type="linear" dataKey={l.key} name={l.name} stroke={l.color} dot={false}
                  strokeDasharray={l.dash} isAnimationActive={false} strokeWidth={1.75} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function LiveCharts({ series }) {
  const data = useMemo(() => series.map((p) => ({
    timestamp: p.timestamp,
    phase: p.drive_phase,
    speed: has(p.velocity) ? p.velocity * 3.6 : null,
    pElec: p.electrical_power ?? null,
    pMech: p.power ?? null,
    motor_temp: p.motor_temp ?? null,
    controller_temp: p.controller_temp ?? null,
    battery_temp: p.battery_temp ?? null,
    ambient_temp: p.ambient_temp ?? null,
    idc: p.idc ?? null,
  })), [series])
  const spans = useMemo(() => burnSpans(data), [data])
  const last = data.length ? data[data.length - 1].timestamp : 0

  return (
    <section className="panel logger">
      <header className="panel-head">
        <h2>Data logger</h2>
        <span className="panel-tag"><i className="key key-burn" />faixa sombreada = fase BURN · eixo em s relativos</span>
      </header>
      {data.length === 0 ? (
        <p className="muted">Aguardando amostras.</p>
      ) : (
        TRACES.map((t, i) => (
          <Trace key={t.id} trace={t} data={data} spans={spans} last={last} isLast={i === TRACES.length - 1} />
        ))
      )}
    </section>
  )
}
