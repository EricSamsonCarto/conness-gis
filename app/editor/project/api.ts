// the dev server's /api/projects endpoints (scripts/projects-api-plugin.ts)
export type ProjectSummary = {
  id: string
  title: string | null
  layers: number | null
  modified: number | null
  // doesn't pass loadProject (scripts/project-config-plugin.ts)
  problems: boolean
}

// an older project brought up to this release on open or import
export type Upgraded = { from: string; to: string; changes: string[] }

// a Blob is sent as is, anything else as JSON
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const raw = body instanceof Blob
  const res = await fetch(`/api/projects${path}`, {
    method,
    headers: body && !raw ? { 'Content-Type': 'application/json' } : undefined,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  // the status rides along, 409 means the file name exists
  if (!res.ok) throw Object.assign(new Error(data.error ?? res.statusText), { status: res.status })
  return data as T
}

// the names the server takes for uploads, spaces become dashes
export const cleanFileName = (name: string) =>
  name.replace(/[^\w.-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+/, '')
