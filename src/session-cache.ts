import { localStore } from './storage'
import type { Session } from './types'

// Treat a session as spent slightly before its real deadline so a token that
// dies mid-request never reaches the iframe.
const EXPIRY_SKEW_MS = 60_000

export class SessionCache {
  private readonly key: string

  constructor(origin: string) {
    // Scoped by origin: two FeedLog orgs embedded on the same host must not
    // read each other's session token.
    this.key = `feedlog:widget:session:${origin}`
  }

  read(): Session | null {
    const raw = localStore().get(this.key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<Session>
      if (typeof parsed?.email !== 'string' || typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'string') {
        return null
      }
      const session: Session = { email: parsed.email, token: parsed.token, expiresAt: parsed.expiresAt }
      if (isExpired(session)) {
        this.clear()
        return null
      }
      return session
    }
    catch {
      this.clear()
      return null
    }
  }

  /** Returns the cached session only when it belongs to `email`. */
  readFor(email: string): Session | null {
    const session = this.read()
    if (!session) return null
    // A different identity on a shared computer must never inherit the previous
    // person's session, so a mismatch discards rather than reuses.
    if (session.email !== email) {
      this.clear()
      return null
    }
    return session
  }

  write(session: Session): void {
    localStore().set(this.key, JSON.stringify(session))
  }

  clear(): void {
    localStore().remove(this.key)
  }
}

function isExpired(session: Session): boolean {
  const deadline = Date.parse(session.expiresAt)
  if (Number.isNaN(deadline)) return true
  return deadline - EXPIRY_SKEW_MS <= Date.now()
}
