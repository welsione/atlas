import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const type = process.argv[2] ?? here.split('/').at(-2)
const outDir = resolve(here, '../ui')
const tmp = resolve(here, '.build-tmp')

execSync('npx vite build --outDir ' + tmp + ' --emptyOutDir', { cwd: here, stdio: 'inherit' })
const entryPath = resolve(tmp, 'entry.js')
const hash = createHash('sha256').update(readFileSync(entryPath)).digest('hex').slice(0, 8)
const entryName = `entry.${hash}.js`
renameSync(entryPath, resolve(tmp, entryName))
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
for (const f of readdirSync(tmp)) renameSync(resolve(tmp, f), resolve(outDir, f))
const manifest = JSON.parse(readFileSync(resolve(here, 'src/manifest.json'), 'utf8'))
manifest.entry = entryName
if (Array.isArray(manifest.slots)) manifest.slots = manifest.slots.map((s) => ({ ...s, entry: entryName }))
writeFileSync(resolve(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`[plugin-ui] ${type}: 完成 → ${outDir}（entry=${entryName}）`)
