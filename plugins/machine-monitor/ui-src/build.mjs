import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const type = process.argv[2] ?? here.split('/').at(-2)
const outDir = resolve(here, '../ui')
const tmp = resolve(here, '.build-tmp')

execSync('npx vite build --outDir ' + tmp + ' --emptyOutDir', { cwd: here, stdio: 'inherit' })
const entryPath = resolve(tmp, 'entry.js')

// 平台只加载 entry.js，不注入 style.css：把产物 CSS 内联进 entry（模块加载时挂 <style>）
const cssPath = resolve(tmp, 'style.css')
if (existsSync(cssPath)) {
  const css = readFileSync(cssPath, 'utf8')
  const inline = `;(()=>{const s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();`
  writeFileSync(entryPath, inline + readFileSync(entryPath, 'utf8'))
}

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
