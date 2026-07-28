/**
 * Web Storage behind a try/catch, with an in-memory fallback. Private-mode
 * browsers throw on both access and write; losing persistence only costs one
 * extra exchange per page load, so degrading is always preferable to failing.
 */
export interface KeyValueStore {
  get: (key: string) => string | null
  set: (key: string, value: string) => void
  remove: (key: string) => void
}

function probe(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  try {
    const store = window[kind]
    const probeKey = '__feedlog_probe__'
    store.setItem(probeKey, '1')
    store.removeItem(probeKey)
    return store
  }
  catch {
    return null
  }
}

function createStore(kind: 'localStorage' | 'sessionStorage'): KeyValueStore {
  const native = probe(kind)
  if (native) {
    return {
      get: (key) => {
        try {
          return native.getItem(key)
        }
        catch {
          return null
        }
      },
      set: (key, value) => {
        try {
          native.setItem(key, value)
        }
        catch {
          // Quota or a mid-session permission change — the caller keeps working.
        }
      },
      remove: (key) => {
        try {
          native.removeItem(key)
        }
        catch {
          // Same as set: never let storage break the widget.
        }
      },
    }
  }

  const memory = new Map<string, string>()
  return {
    get: key => memory.get(key) ?? null,
    set: (key, value) => void memory.set(key, value),
    remove: key => void memory.delete(key),
  }
}

let local: KeyValueStore | null = null
let session: KeyValueStore | null = null

export function localStore(): KeyValueStore {
  local ??= createStore('localStorage')
  return local
}

export function sessionStore(): KeyValueStore {
  session ??= createStore('sessionStorage')
  return session
}
