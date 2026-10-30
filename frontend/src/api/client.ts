// Єдина точка виходу до бекенду. Фронт ходить тільки в /api.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api${path}`, init)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${r.status}`)
  }
  return r.json() as Promise<T>
}

export const health = () => api<{ ok: boolean }>('/health')
