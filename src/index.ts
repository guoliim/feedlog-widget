import type { WidgetOptions } from './types'
import { boot } from './widget'

export type { WidgetAuth, WidgetOptions, WidgetTheme } from './types'

let created = false

/**
 * Mounts the FeedLog feedback widget. This is the entire public surface: there
 * is no return value, no instance and no events — the widget manages its own
 * visibility (launcher opens it, the panel's own close button closes it).
 */
export function createWidget(options: WidgetOptions): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  // Set before any await so React StrictMode's double-mount and HMR re-runs
  // cannot slip a second launcher through.
  if (created) {
    console.warn('[feedlog/widget] createWidget() was already called; ignoring this call')
    return
  }

  if (!options?.baseUrl || typeof options.baseUrl !== 'string') {
    throw new TypeError('[feedlog/widget] createWidget requires a baseUrl')
  }
  if (typeof options.auth?.getToken !== 'function') {
    throw new TypeError('[feedlog/widget] createWidget requires auth.getToken')
  }

  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  let origin: string
  try {
    origin = new URL(baseUrl).origin
  }
  catch {
    throw new TypeError(`[feedlog/widget] baseUrl is not a valid URL: ${options.baseUrl}`)
  }

  // A leading-slash, same-origin path only — reject anything that could point
  // the iframe at another origin (`//evil.com`, `https://…`).
  const rawPath = options.embedPath ?? '/widget/embed'
  const embedPath = (typeof rawPath === 'string' && rawPath.startsWith('/') && !rawPath.startsWith('//'))
    ? rawPath
    : '/widget/embed'

  created = true
  void boot({
    baseUrl,
    origin,
    auth: options.auth,
    theme: options.theme ?? 'auto',
    embedPath,
  })
}
