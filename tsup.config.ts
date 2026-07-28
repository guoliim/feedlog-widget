import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2020',
  dts: true,
  clean: true,
  minify: true,
  treeshake: true,
  // The SDK runs on the customer's page and must never pull in a dependency.
  external: [],
  outExtension: () => ({ js: '.js' }),
})
