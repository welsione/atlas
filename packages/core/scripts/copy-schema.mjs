import { copyFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
mkdirSync(resolve(here, '../dist/db'), { recursive: true })
copyFileSync(resolve(here, '../src/db/schema.sql'), resolve(here, '../dist/db/schema.sql'))
console.log('[core] schema.sql → dist/db/')
