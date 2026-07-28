import { exchange } from './api'
import { emailFromJwt } from './jwt'
import { clearLoginPending, markLoginPending } from './login-marker'
import type { SessionCache } from './session-cache'
import type { Session, WidgetAuth } from './types'

export interface ResolveOptions {
  /** Escalate to `auth.login()` when a silent `getToken()` still comes back null. */
  allowLogin?: boolean
  /** Force a fresh exchange — used after a 401 proves the cached token is dead. */
  ignoreCache?: boolean
}

interface Inflight {
  options: Required<ResolveOptions>
  promise: Promise<Session | null>
}

/**
 * Owns the whole auth dance: customer JWT -> email -> cached session or a fresh
 * exchange. Every entry point funnels through `resolve` so that only one flow
 * runs at a time — otherwise a double-click on the iframe's sign-in button
 * would open two host login popups.
 */
export class AuthManager {
  private inflight: Inflight | null = null
  private queue: Promise<unknown> = Promise.resolve()

  constructor(
    private readonly baseUrl: string,
    private readonly origin: string,
    private readonly auth: WidgetAuth,
    private readonly cache: SessionCache,
  ) {}

  resolve(options: ResolveOptions = {}): Promise<Session | null> {
    const wanted: Required<ResolveOptions> = {
      allowLogin: options.allowLogin === true,
      ignoreCache: options.ignoreCache === true,
    }

    const current = this.inflight
    if (current && covers(current.options, wanted)) return current.promise

    // Not covered by what is already running, so chain behind it rather than
    // racing it — two concurrent exchanges would fight over the same cache slot.
    const promise = this.queue.then(() => this.run(wanted))
    const entry: Inflight = { options: wanted, promise }
    this.inflight = entry
    this.queue = promise.then(noop, noop)
    promise.then(noop, noop).then(() => {
      if (this.inflight === entry) this.inflight = null
    })
    return promise
  }

  /** A fresh customer JWT for the pop-out handoff; deliberately outside the session flow. */
  getCustomerJwt(): Promise<string | null> {
    return Promise.resolve().then(() => this.auth.getToken())
  }

  private async run(options: Required<ResolveOptions>): Promise<Session | null> {
    let jwt = await this.auth.getToken()

    if (!jwt && options.allowLogin && this.auth.login) {
      // Written before the call because a redirect-style login never returns
      // here — the marker is what lets the reloaded page reopen the panel.
      markLoginPending(this.origin)
      try {
        await this.auth.login()
      }
      catch {
        // The host's login UI failing is not decisive; getToken() below rules.
      }
      clearLoginPending(this.origin)
      jwt = await this.auth.getToken()
    }

    if (!jwt) {
      // Signed out wins over anything cached: on a shared computer the previous
      // person's session must not survive their sign-out.
      this.cache.clear()
      return null
    }

    const email = emailFromJwt(jwt)
    if (email && !options.ignoreCache) {
      const cached = this.cache.readFor(email)
      if (cached) return cached
    }
    if (options.ignoreCache) this.cache.clear()

    const result = await exchange(this.baseUrl, jwt)
    const session: Session = {
      email: email ?? result.user?.email ?? '',
      token: result.token,
      expiresAt: result.expiresAt,
    }
    // Without an email from the JWT there is no key to match on later, so the
    // entry would never be readable — skip the write instead of storing junk.
    if (email) this.cache.write(session)
    return session
  }
}

function covers(running: Required<ResolveOptions>, wanted: Required<ResolveOptions>): boolean {
  return (running.allowLogin || !wanted.allowLogin) && (running.ignoreCache || !wanted.ignoreCache)
}

function noop(): void {}
