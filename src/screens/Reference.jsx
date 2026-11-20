import { ALERTS, DATA_PATH, EFFICIENCY_CASES, MODEL_PARAMETERS, SIGNAL_STATUS, SIGNALS } from '../data/catalog'
import { nodeRows } from '../lib/telemetry'
import { Panel } from '../ui/kit'

export function Sinais({ t }) {
  return (
    <div className="signals">
      <Panel title="Origem de cada dado" note="Esquemático rev. 3.0 e contrato de telemetria">
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>Domínio</th><th>Sinal</th><th>Campo</th><th>Origem</th><th>Caminho</th><th>Situação</th></tr></thead>
            <tbody>
              {SIGNALS.map(([domain, name, field, origin, path, kind, label]) => (
                <tr key={name}>
                  <td className="muted">{domain}</td><td className="strong">{name}</td><td className="muted">{field}</td><td>{origin}</td><td className="muted">{path}</td>
                  <td><span className="state"><i className={kind} />{kind === 'simulated' && t.source.signal ? t.source.signal : label ?? SIGNAL_STATUS[kind]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="stack">
        <Panel title="Saúde do barramento RS485" note="Estado, idade e erros">
          <div className="kv node-health">{nodeRows(t.busHealth).map(([a, b]) => <div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div>
        </Panel>
        <Panel title="Caminho do dado" note="Sequência de cada amostra">
          <ol className="path">{DATA_PATH.map(([a, b]) => <li key={a}><strong>{a}</strong><span>{b}</span></li>)}</ol>
        </Panel>
        <Panel title="Legenda">
          <div className="legend-list">
            {Object.entries(SIGNAL_STATUS).map(([kind, label]) => <span className="state" key={kind}><i className={kind} />{label}</span>)}
          </div>
        </Panel>
      </div>
    </div>
  )
}

export function Eficiencia() {
  return (
    <div className="stack">
      <div className="page-title"><h1>Casos de eficiência</h1><p className="muted">{MODEL_PARAMETERS.map(([a, b]) => `${a}: ${b}`).join(' · ')}</p></div>
      <div className="case-cards">
        {EFFICIENCY_CASES.map((c) => (
          <section className="panel" key={c.name}>
            <h2>{c.name}</h2>
            <p className="case-value"><strong>{c.short}</strong> km/kWh</p>
            <p className="muted">{c.condition}</p>
          </section>
        ))}
      </div>
      <Panel title="Comparação" note="Resultados de simulação">
        <div className="table-scroll">
          <table className="table large">
            <thead><tr><th>Caso</th><th>Distância</th><th>Tempo</th><th>Vel. média</th><th>km/kWh</th><th>Wh/km</th><th>Pico de corrente</th><th>Conferência</th></tr></thead>
            <tbody>{EFFICIENCY_CASES.map((c) => <tr key={c.name}><td className="strong">{c.name}</td><td>{c.distance}</td><td>{c.time}</td><td>{c.speed}</td><td className="strong">{c.value}</td><td>{c.whKm}</td><td>{c.peak}</td><td className="muted">{c.check}</td></tr>)}</tbody>
          </table>
        </div>
      </Panel>
      <div className="case-notes">
        {EFFICIENCY_CASES.filter((c) => c.note).map((c) => <Panel title={c.name} key={c.name}><p>{c.note}</p></Panel>)}
      </div>
      <p className="muted small">Condições diferentes entre os casos. Pico do ciclo calculado com 344,7 W a 48 V.</p>
    </div>
  )
}

export function Alertas({ t }) {
  const active = new Set((t.latest?.alerts ?? []).map((a) => a.code))
  return (
    <div className="stack">
      <div className="page-title">
        <h1>Casos de alerta</h1>
        <p className="muted">Limites do código publicado. As ações são uma proposta a validar pela equipe antes do uso no carro.</p>
      </div>
      <section className="panel">
        <div className="table-scroll">
          <table className="table matrix">
            <thead><tr><th>Código</th><th>Condição</th><th>Piloto</th><th>Mecânica, com o carro parado</th><th>Box</th></tr></thead>
            <tbody>
              {ALERTS.map((a) => (
                <tr key={a.code} className={active.has(a.code) ? 'active' : ''}>
                  <td className="strong"><span className="state"><i className={a.severity} />{a.code}</span></td>
                  <td className="muted">{a.when}</td><td className="strong">{a.pilot ?? 'Sem ação'}</td><td>{a.mechanic}</td><td>{a.box}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
