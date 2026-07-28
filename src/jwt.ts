/**
 * Reads the `email` claim out of a customer-signed JWT.
 *
 * Decoding only — the signature is never checked here. Verification is the
 * server's job during exchange; the browser needs the email purely as a cache
 * key, and a forged one buys nothing (the exchange would still be rejected).
 */
export function emailFromJwt(jwt: string): string | null {
  const parts = jwt.split('.')
  if (parts.length < 2) return null
  const segment = parts[1]
  if (!segment) return null

  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    // The payload may carry a non-ASCII `name`, so decode as UTF-8 rather than
    // feeding atob's latin1 output straight to JSON.parse.
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!payload || typeof payload !== 'object') return null
    const email = (payload as { email?: unknown }).email
    if (typeof email !== 'string' || !email.includes('@')) return null
    // Normalized the same way the server normalizes it, so a cached entry keyed
    // on the server's answer still matches on the next page load.
    return email.trim().toLowerCase()
  }
  catch {
    return null
  }
}
