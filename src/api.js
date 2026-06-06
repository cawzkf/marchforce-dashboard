
export async function fetchSessions() {
  const res = await fetch('/api/sessions')
  if (!res.ok) throw new Error('Falha ao buscar sessões')
  return res.json()
}

export async function fetchSessionHistory(sessionId) {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/telemetry`)
  if (!res.ok) throw new Error('Falha ao buscar histórico')
  return res.json()
}
