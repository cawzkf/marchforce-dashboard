import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchSessions, fetchSessionHistory } from '../api'

export default function SessionHistory() {
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSessions().then(setSessions).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!selected) return
    fetchSessionHistory(selected)
      .then((rows) => setHistory(rows.map((r) => ({ ...r, t: new Date(r.time).getTime() }))))
      .catch((e) => setError(e.message))
  }, [selected])

  if (error) return <div className="error">Erro: {error}</div>

  return (
    <div className="session-history">
      <aside className="session-list panel">
        <h2 className="panel-title">Sessões de teste</h2>
        {sessions.length === 0 && <p className="muted">Nenhuma sessão registrada ainda.</p>}
        <ul>
          {sessions.map((s) => (
            <li key={s.id}
                className={selected === s.id ? 'active' : ''}
                onClick={() => setSelected(s.id)}>
              <strong>{s.id}</strong>
              <span className="muted">
                {s.source} · {s.samples} amostras
                {s.distance != null ? ` · ${Number(s.distance).toFixed(0)} m` : ''}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="session-detail">
        {!selected ? (
          <p className="muted">Selecione uma sessão para ver o histórico.</p>
        ) : (
          <>
            <h2 className="panel-title mono">{selected}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="t" stroke="#8c8c8c" fontSize={11}
                       tickFormatter={(t) => new Date(t).toLocaleTimeString('pt-BR', { hour12: false })} />
                <YAxis stroke="#8c8c8c" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0d0d0d', border: '1px solid #ff5400', borderRadius: 4 }} />
                <Line type="monotone" dataKey="power" stroke="#ff5400" dot={false} name="Potência (W)" />
                <Line type="monotone" dataKey="velocity" stroke="#f2f2f2" dot={false} name="Velocidade (m/s)" />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </div>
    </div>
  )
}
