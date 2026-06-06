import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

function tickTime(ts) {
  const d = new Date(ts * 1000)
  return d.toLocaleTimeString('pt-BR', { hour12: false })
}

function Chart({ title, data, dataKey, color }) {
  return (
    <div className="chart">
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2c" />
          <XAxis dataKey="timestamp" tickFormatter={tickTime} minTickGap={40}
                 stroke="#9a9a9a" fontSize={11} />
          <YAxis stroke="#9a9a9a" fontSize={11} width={48} />
          <Tooltip labelFormatter={tickTime}
                   contentStyle={{ background: '#161616', border: '1px solid #2c2c2c' }} />
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false}
                isAnimationActive={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function LiveCharts({ series }) {
  return (
    <section className="charts">
      <Chart title="Potência (W)" data={series} dataKey="power" color="#ff6a00" />
      <Chart title="Velocidade (m/s)" data={series} dataKey="velocity" color="#ffffff" />
      <Chart title="Tensão DC (V)" data={series} dataKey="vdc" color="#ffb066" />
      <Chart title="Corrente DC (A)" data={series} dataKey="idc" color="#ff8c33" />
      <Chart title="SoC" data={series} dataKey="soc" color="#bdbdbd" />
      <Chart title="Consumo específico (Wh/m)" data={series} dataKey="specific_consumption" color="#ff5500" />
    </section>
  )
}
