// One-command demo dev loop: serve demo-host.html over http AND re-inline the
// SDK whenever src/ changes. build-demo.mjs already runs its own tsup build, so
// watching src/ and re-running it is all we need — no separate tsup --watch.
import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from './serve-demo.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const srcDir = join(here, '..', 'src')
const buildDemo = join(here, 'build-demo.mjs')

function rebuild() {
  return new Promise((resolve) => {
    spawn(process.execPath, [buildDemo], { stdio: 'inherit' }).on('close', resolve)
  })
}

await rebuild() // initial inline before the first request
startServer()

// Debounce editor saves (which fire several change events), and coalesce any
// change arriving mid-build into exactly one follow-up build.
let building = false
let pending = false
let timer = null
async function trigger() {
  if (building) { pending = true; return }
  building = true
  console.log('[dev:demo] src changed → re-inlining SDK…')
  await rebuild()
  building = false
  if (pending) { pending = false; trigger() }
}
watch(srcDir, { recursive: true }, () => {
  clearTimeout(timer)
  timer = setTimeout(trigger, 150)
})

console.log('[dev:demo] watching src/ — edit the SDK and refresh the browser')
