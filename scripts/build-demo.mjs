// Regenerates the inlined SDK inside playground/demo-host.html.
//
// The demo must be a single self-contained HTML file that opens with no build
// step. The SDK, however, is ESM (`export { createWidget }`), which a classic
// inline <script> cannot bind. So we build an IIFE global bundle
// (window.FeedLogWidget) and paste it between two markers in the HTML. The
// published npm package is unaffected — this global build is demo-only and
// never lands in dist/.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const htmlPath = join(root, 'playground', 'demo-host.html')
const START = '/* FEEDLOG_SDK_START */'
const END = '/* FEEDLOG_SDK_END */'

const outDir = mkdtempSync(join(tmpdir(), 'feedlog-demo-'))
try {
  execFileSync('npx', [
    'tsup', 'src/index.ts',
    '--format', 'iife',
    '--global-name', 'FeedLogWidget',
    '--minify',
    '--no-config',
    '--out-dir', outDir,
  ], { cwd: root, stdio: 'inherit' })

  const sdk = readFileSync(join(outDir, 'index.global.js'), 'utf8').trim()
  const html = readFileSync(htmlPath, 'utf8')

  const from = html.indexOf(START)
  const to = html.indexOf(END)
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`markers ${START} / ${END} not found in demo-host.html`)
  }

  const before = html.slice(0, from + START.length)
  const after = html.slice(to)
  const next = `${before}\n${sdk}\n${after}`
  writeFileSync(htmlPath, next)
  console.log(`Inlined ${sdk.length} bytes of SDK into ${htmlPath}`)
}
finally {
  rmSync(outDir, { recursive: true, force: true })
}
