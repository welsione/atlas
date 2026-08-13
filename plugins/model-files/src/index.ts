import { createHash } from 'node:crypto'
import type { AtlasPlugin, PluginEnvironment } from '@atlas/types'

/**
 * model-files 插件：模型文件管理（APP_LOCAL）。
 * 文件存 env.files()（实例隔离存储根），元数据存通用存储（entity_key=files）；
 * 公开下载经 env.files().publish → 平台 /api/files/{token}/download（防穷举/304/限流/审计）。
 */
interface ModelFileEntry {
  path: string
  sizeBytes: number
  checksum: string
}

interface ModelFile {
  id: number
  name: string
  category: string
  description: string
  kind: 'FILE' | 'DIRECTORY'
  files: ModelFileEntry[]
  totalSize: number
  fileCount: number
  version: number
  contentHash: string
  token: string
  downloadCount: number
  createdAt: string
  updatedAt: string
}

const now = (): string => new Date().toISOString().slice(0, 19).replace('T', ' ')

const plugin: AtlasPlugin = {
  type: 'model-files',
  name: '模型文件',
  describe: '模型文件上传、固定下载链接（token 防穷举）、版本/HASH 条件下载',
  defaultDataScope: 'APP_LOCAL',

  /** 应用删除时级联清理本插件表（model_files 有 app_id；download_logs/upload_logs 按 file_id 关联，历史遗留表不单独清理）。 */
  cleanupTables: () => [{ table: 'model_files', column: 'app_id' }],

  /** 本插件日志表：公开下载/上传审计由 LogCleanupService 按时间列定时清理。 */
  logTables: () => [
    { table: 'download_logs', column: 'downloaded_at' },
    { table: 'upload_logs', column: 'uploaded_at' },
  ],

  /** 数据集注册：模型文件库整体发布为「模型文件」数据集，复用数据集接口与密级管理。 */
  datasets: () => [
    {
      key: 'model-files',
      name: '模型文件',
      sensitivity: 'INTERNAL',
      refreshMode: 'MANUAL',
      render: async (env) => {
        const list = (await env.store().get<ModelFile[]>('files')) ?? []
        return JSON.stringify({
          count: list.length,
          totalSize: list.reduce((m, f) => m + f.totalSize, 0),
          files: list.map((f) => ({
            id: f.id,
            name: f.name,
            category: f.category,
            description: f.description,
            kind: f.kind,
            version: f.version,
            contentHash: f.contentHash,
            fileCount: f.fileCount,
            totalSize: f.totalSize,
            updatedAt: f.updatedAt,
            entries: f.files.map((e) => ({ path: e.path, sizeBytes: e.sizeBytes, checksum: e.checksum })),
          })),
        })
      },
      assets: async (env) => {
        const list = (await env.store().get<ModelFile[]>('files')) ?? []
        const out: Array<{ path: string; mime: string }> = []
        for (const f of list) {
          for (const e of f.files) out.push({ path: `${f.id}/${e.path}`, mime: mimeOf(e.path) })
        }
        return out
      },
      assetSource: async (env, path) => {
        const idx = path.indexOf('/')
        if (idx <= 0) return null
        const id = path.slice(0, idx)
        const rel = path.slice(idx + 1)
        if (!id || !rel) return null
        const list = (await env.store().get<ModelFile[]>('files')) ?? []
        const row = list.find((f) => f.id === Number(id))
        if (!row) return null
        return env.files().read(`${id}/${rel}`)
      },
    },
  ],

  endpoints: () => [
    {
      method: 'GET', path: 'list', summary: '文件列表',
      handle: async (env) => (await env.store().get<ModelFile[]>('files')) ?? [],
    },
    {
      method: 'POST', path: 'upload', summary: '上传文件（multipart 或 JSON base64）',
      handle: async (env, _params, body) => {
        const store = env.store()
        const files = env.files()
        const list = (await store.get<ModelFile[]>('files')) ?? []
        const uploaded: Array<{ path: string; data: Buffer }> = []
        let category = 'default'
        let description = ''
        let updateId: number | undefined
        let updateToken: string | undefined
        if (
          body && typeof body === 'object'
          && 'files' in (body as object) && Array.isArray((body as { files: unknown[] }).files)
          && (body as { files: Array<{ originalname?: string }> }).files[0]?.originalname !== undefined
        ) {
          const req = body as { fields?: Record<string, string>; files: Array<{ originalname: string; buffer: Buffer }> }
          category = req.fields?.category ?? 'default'
          description = req.fields?.description ?? ''
          updateId = req.fields?.updateId ? Number(req.fields.updateId) : undefined
          updateToken = req.fields?.token
          for (const f of req.files) uploaded.push({ path: f.originalname, data: f.buffer })
        } else {
          const req = body as { files?: Array<{ path: string; base64: string }>; category?: string; description?: string; token?: string; updateId?: number }
          category = req.category ?? 'default'
          description = req.description ?? ''
          updateId = req.updateId
          updateToken = req.token
          for (const f of req.files ?? []) uploaded.push({ path: f.path, data: Buffer.from(f.base64, 'base64') })
        }
        if (uploaded.length === 0) throw new Error('缺少文件')

        const existing = updateId
          ? list.find((m) => m.id === Number(updateId))
          : updateToken
            ? list.find((m) => m.token === updateToken)
            : undefined
        const dirId = existing ? `${existing.id}` : String(list.reduce((m, f) => Math.max(m, f.id), 0) + 1)

        // 清空旧文件（更新场景）
        if (existing) {
          for (const e of existing.files) await files.remove(`${dirId}/${e.path}`)
        }

        const entries: ModelFileEntry[] = []
        let totalSize = 0
        for (const f of uploaded) {
          const safePath = f.path.replaceAll('\\', '/').replace(/^\.?\//, '')
          if (safePath.includes('..') || safePath.startsWith('/')) throw new Error(`非法文件路径: ${f.path}`)
          await files.write(`${dirId}/${safePath}`, f.data)
          totalSize += f.data.length
          entries.push({ path: safePath, sizeBytes: f.data.length, checksum: createHash('sha256').update(f.data).digest('hex') })
        }
        const contentHash = createHash('sha256')
          .update(entries.map((e) => `${e.path}:${e.sizeBytes}:${e.checksum}`).join('|'))
          .digest('hex')

        if (existing) {
          const idx = list.indexOf(existing)
          const next: ModelFile = {
            ...existing,
            name: entries.length === 1 ? entries[0].path.split('/').pop() ?? 'file' : category,
            category,
            description,
            files: entries,
            totalSize,
            fileCount: entries.length,
            version: existing.version + 1,
            contentHash,
            downloadCount: 0,
            updatedAt: now(),
          }
          list[idx] = next
          await store.put('files', list)
          return next
        }

        const published = await files.publish(
          `${dirId}/${entries[0].path}`,
          entries.length === 1 ? entries[0].path.split('/').pop() ?? 'file' : category,
        )
        const next: ModelFile = {
          id: Number(dirId),
          name: entries.length === 1 ? entries[0].path.split('/').pop() ?? 'file' : category,
          category,
          description,
          kind: entries.length > 1 ? 'DIRECTORY' : 'FILE',
          files: entries,
          totalSize,
          fileCount: entries.length,
          version: 1,
          contentHash,
          token: published.token,
          downloadCount: 0,
          createdAt: now(),
          updatedAt: now(),
        }
        list.push(next)
        await store.put('files', list)
        void env.datasets().refresh('model-files').catch(() => undefined)
        env.info(`模型文件上传：${next.name}（${entries.length} 个文件，${totalSize} 字节）`)
        return next
      },
    },
    {
      method: 'DELETE', path: 'delete/{id}', summary: '删除文件',
      handle: async (env, params) => {
        const store = env.store()
        const files = env.files()
        const list = (await store.get<ModelFile[]>('files')) ?? []
        const row = list.find((f) => f.id === Number(params.id))
        if (!row) throw new Error(`模型文件不存在: ${params.id}`)
        for (const e of row.files) await files.remove(`${row.id}/${e.path}`)
        if (row.token) await files.unpublish(row.token)
        await store.put('files', list.filter((f) => f.id !== row.id))
        void env.datasets().refresh('model-files').catch(() => undefined)
        env.ops().warn(`删除模型文件：${row.name}`)
        return null
      },
    },
    {
      method: 'GET', path: 'download/{id}', summary: '下载文件（二进制）',
      handle: async (env, params) => {
        const list = (await env.store().get<ModelFile[]>('files')) ?? []
        const row = list.find((f) => f.id === Number(params.id))
        if (!row) throw new Error(`模型文件不存在: ${params.id}`)
        const files = env.files()
        if (row.fileCount === 1) {
          const data = await files.read(`${row.id}/${row.files[0].path}`)
          if (!data) throw new Error('文件内容缺失')
          row.downloadCount += 1
          await env.store().put('files', list)
          // 直接返回 Buffer（平台 $binary 支持 Buffer 通道，避免 base64 全量往返）
          return { $binary: data, $mime: mimeOf(row.files[0].path), $filename: row.files[0].path.split('/').pop() }
        }
        throw new Error('目录请使用公开下载链接')
      },
    },
    {
      method: 'POST', path: 'publish/{id}', summary: '（重新）公开托管（仅单个文件）',
      handle: async (env, params) => {
        const store = env.store()
        const files = env.files()
        const list = (await store.get<ModelFile[]>('files')) ?? []
        const row = list.find((f) => f.id === Number(params.id))
        if (!row) throw new Error(`模型文件不存在: ${params.id}`)
        if (row.fileCount > 1) throw new Error('目录（多文件）不支持公开托管，请按单文件上传')
        // 重新发布前先撤销旧 token，防止孤儿公开 token 累积（旧 token 失效后仍可下载已删文件）
        if (row.token) await files.unpublish(row.token)
        const published = await files.publish(`${row.id}/${row.files[0].path}`, row.name)
        row.token = published.token
        await store.put('files', list)
        return published
      },
    },
  ],
}

function mimeOf(path: string): string {
  const lower = path.toLowerCase()
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain'
  if (lower.endsWith('.svg')) return 'image/svg+xml'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.bin') || lower.endsWith('.gguf') || lower.endsWith('.safetensors')) return 'application/octet-stream'
  if (lower.endsWith('.zip')) return 'application/zip'
  if (lower.endsWith('.tar') || lower.endsWith('.gz')) return 'application/gzip'
  return 'application/octet-stream'
}

export default plugin
