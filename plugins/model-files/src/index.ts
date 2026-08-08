import { createHash } from 'node:crypto'
import type { AibasePlugin, PluginEnvironment } from '@atlas/types'

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

const plugin: AibasePlugin = {
  type: 'model-files',
  name: '模型文件',
  describe: '模型文件上传、固定下载链接（token 防穷举）、版本/HASH 条件下载',
  defaultDataScope: 'APP_LOCAL',

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
        if (body && typeof body === 'object' && 'files' in (body as object) && Array.isArray((body as { files: Array<{ originalname: string; buffer: Buffer }> }).files)) {
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
          return { $binary: data.toString('base64'), $mime: mimeOf(row.files[0].path), $filename: row.files[0].path.split('/').pop() }
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
  if (lower.endsWith('.txt')) return 'text/plain'
  if (lower.endsWith('.bin')) return 'application/octet-stream'
  return 'application/octet-stream'
}

export default plugin
