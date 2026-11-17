import { html, title } from '@user/info'
import { storageKey } from './storageKey'

// key embeds a hash of info.md, so editing it re-shows the modal

// djb2 fingerprint, collisions are harmless
function hashString(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

const STORAGE_KEY = storageKey('info-dismissed', hashString(title + html))

// localStorage can throw (private mode)
export function isInfoDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setInfoDismissed(dismissed: boolean): void {
  try {
    if (dismissed) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage unavailable, so the choice won't persist
  }
}
