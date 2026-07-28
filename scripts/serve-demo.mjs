// Serves playground/ over http so demo-host.html runs with a real origin.
// The demo needs http (not file://): a file:// page reports a `null` origin,
// which breaks the widget's cross-origin postMessage + CORS. Zero deps.
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'playground')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

export function startServer(port = Number(process.env.PORT || 5173)) {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname)
    if (path === '/') path = '/demo-host.html'
    // Keep the served file inside playground/ — reject any `..` traversal.
    const file = normalize(join(root, path))
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  server.listen(port, () => {
    console.log(`demo-host → http://localhost:${port}/demo-host.html`)
  })
  return server
}

// Run directly (`node scripts/serve-demo.mjs`) → just serve.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServer()
}
