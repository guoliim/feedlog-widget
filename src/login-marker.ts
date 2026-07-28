import { sessionStore } from './storage'

// Long enough to cover a full OAuth round trip, short enough that a stale marker
// cannot pop the panel open on some unrelated later visit.
const TTL_MS = 5 * 60 * 1000

function key(origin: string): string {
  return `feedlog:widget:login-pending:${origin}`
}

/**
 * Marks "a host login is in progress". A popup-style `login()` clears it when it
 * settles; a redirect-style one never gets the chance, which is precisely the
 * signal the reloaded page uses to reopen the widget. One code path covers both.
 */
export function markLoginPending(origin: string): void {
  sessionStore().set(key(origin), String(Date.now() + TTL_MS))
}

export function clearLoginPending(origin: string): void {
  sessionStore().remove(key(origin))
}

/** Reads and removes the marker — it must only ever fire once. */
export function consumeLoginPending(origin: string): boolean {
  const raw = sessionStore().get(key(origin))
  if (!raw) return false
  sessionStore().remove(key(origin))
  const deadline = Number(raw)
  return Number.isFinite(deadline) && deadline > Date.now()
}
