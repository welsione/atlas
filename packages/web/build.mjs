// 主应用构建：vue-tsc 检查 → vite 主构建 → vendor 独立构建 → 产物归位 dist/runtime/ → import map 版本戳
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

console.log('[web] vue-tsc...')
execSync('npx vue-tsc -b', { cwd: here, stdio: 'inherit' })

console.log('[web] vite 主构建...')
execSync('npx vite build', { cwd: here, stdio: 'inherit' })

console.log('[web] vendor 独立构建...')
const vendorTmp = resolve(here, '.vendor-tmp')
rmSync(vendorTmp, { recursive: true, force: true })
for (const mode of ['vue-vendor', 'ep-vendor', 'icons-vendor', 'atlas-runtime']) {
  execSync(
    `npx vite build --config vendor.vite.config.ts --mode ${mode} --outDir ${resolve(vendorTmp, mode)} --emptyOutDir`,
    { cwd: here, stdio: 'inherit' },
  )
}

const dist = resolve(here, 'dist')
const runtimeDir = resolve(dist, 'runtime')
rmSync(runtimeDir, { recursive: true, force: true })
mkdirSync(runtimeDir, { recursive: true })
for (const mode of ['vue-vendor', 'ep-vendor', 'icons-vendor', 'atlas-runtime']) {
  execSync(`cp -R ${resolve(vendorTmp, mode)}/. ${runtimeDir}/`)
}
rmSync(vendorTmp, { recursive: true, force: true })

// import map 版本戳：vendor 变更后浏览器强制拉新（启发式缓存兜底）
const stamp = Date.now().toString(36)
const indexHtml = resolve(dist, 'index.html')
const html = readFileSync(indexHtml, 'utf8').replace(
  /\/runtime\/(vue-vendor|ep-vendor|icons-vendor|atlas-runtime)\.js/g,
  (m) => `${m}?v=${stamp}`,
)
writeFileSync(indexHtml, html)
console.log(`[web] 完成 → dist/（runtime 共享依赖就绪，vendor stamp=${stamp}）`)
