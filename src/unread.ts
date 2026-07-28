import { fetchUnread, UnauthorizedError } from './api'
import type { AuthManager } from './auth'
import { sessionStore } from './storage'

const TTL_MS = 60_000

interface CacheEntry {
  count: number
  at: number
}

/**
 * Keeps the launcher badge in sync while no iframe is mounted. Once the iframe
 * is alive it becomes the authoritative source (it can zero the count the moment
 * the user reads a thread), so this stops fetching entirely.
 */
export class UnreadTracker {
  private readonly key: string
  private live = false
  private pending: Promise<void> | null = null

  constructor(
    private readonly baseUrl: string,
    origin: string,
    private readonly auth: AuthManager,
    private readonly onCount: (count: number) => void,
  ) {
    this.key = `feedlog:widget:unread:${origin}`
  }

  /** Hands ownership of the count to the iframe. */
  takeOver(): void {
    this.live = true
  }

  releaseOwnership(): void {
    this.live = false
  }

  /** Applies a count pushed by the iframe. */
  push(count: number): void {
    const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
    this.write(safe)
    this.onCount(safe)
  }

  /** Paints the cached count immediately, then refreshes it if it has gone stale. */
  start(): void {
    const cached = this.read()
    if (cached) this.onCount(cached.count)
    void this.refresh()

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.refresh()
    })
  }

  refresh(): Promise<void> {
    if (this.live) return Promise.resolve()
    const cached = this.read()
    if (cached && Date.now() - cached.at < TTL_MS) return Promise.resolve()
    this.pending ??= this.load().finally(() => {
      this.pending = null
    })
    return this.pending
  }

  private async load(): Promise<void> {
    try {
      const session = await this.auth.resolve()
      if (!session) {
        this.clear()
        this.onCount(0)
        return
      }
      let count: number
      try {
        count = await fetchUnread(this.baseUrl, session.token)
      }
      catch (err) {
        if (!(err instanceof UnauthorizedError)) throw err
        // One silent re-exchange covers a session revoked server-side; a second
        // 401 means the identity itself is gone, so stop rather than loop.
        const renewed = await this.auth.resolve({ ignoreCache: true })
        if (!renewed) {
          this.clear()
          this.onCount(0)
          return
        }
        count = await fetchUnread(this.baseUrl, renewed.token)
      }
      this.write(count)
      this.onCount(count)
    }
    catch {
      // A badge is not worth surfacing an error over — leave whatever is painted.
    }
  }

  private read(): CacheEntry | null {
    const raw = sessionStore().get(this.key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as Partial<CacheEntry>
      if (typeof parsed?.count !== 'number' || typeof parsed.at !== 'number') return null
      return { count: parsed.count, at: parsed.at }
    }
    catch {
      return null
    }
  }

  private write(count: number): void {
    sessionStore().set(this.key, JSON.stringify({ count, at: Date.now() } satisfies CacheEntry))
  }

  private clear(): void {
    sessionStore().remove(this.key)
  }
}
