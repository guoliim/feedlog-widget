import { gzipSync } from 'node:zlib'
import { readFileSync, statSync } from 'node:fs'

const file = 'dist/index.js'
try {
  const raw = statSync(file).size
  const gzipped = gzipSync(readFileSync(file)).length
  const kb = (n) => `${(n / 1024).toFixed(2)} KB`
  console.log(`${file}  ${kb(raw)} raw  ${kb(gzipped)} gzip`)
}
catch {
  console.error(`${file} not found — run "pnpm build" first`)
  process.exit(1)
}
