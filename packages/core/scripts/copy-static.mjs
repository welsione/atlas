import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../static')
const dist = resolve(here, '../dist/static')
if (existsSync(src)) {
  rmSync(dist, { recursive: true, force: true })
  mkdirSync(dist, { recursive: true })
  cpSync(src, dist, { recursive: true })
  console.log('[core] static → dist/static/')
}
