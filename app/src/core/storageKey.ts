import { settings } from '@user/settings'

// appId-namespaced so several kit apps can share an origin

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const APP_ID = settings.branding.appId?.trim() || slug(settings.branding.title)

// `mak:<appId>:<kind>[:<suffix>]`
export function storageKey(kind: string, suffix?: string): string {
  const base = `mak:${APP_ID}:${kind}`
  return suffix ? `${base}:${suffix}` : base
}

// `fallback` when missing, corrupt or blocked (private mode)
export function loadStored<T>(kind: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(kind))
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

// false on quota or blocked storage
export function saveStored(kind: string, value: unknown): boolean {
  try {
    localStorage.setItem(storageKey(kind), JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
