import { execFile } from 'node:child_process'
import { statfsSync, readFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import { promisify } from 'node:util'
import type { AibasePlugin, PluginEnvironment } from '@atlas/types'

/**
 * machine-monitor 插件：部署机器性能监控（系统级，GLOBAL_SHARED 全局一份）。
 * - 指标采集：CPU%（双采样差值）、内存、磁盘（statfs）、负载、运行时长、Top 进程；
 *   跨平台尽力而为：非 Linux 平台网络计数为 null，无法读取的指标返回 null 不报错。
 * - 历史：通用存储 entityKey=history，按分钟去重，默认保留 24h（config.historyHours 可调）。
 * - 数据集：声明 datasetSource，用户创建 SCHEDULED 数据集后可定时采样并对外发布。
 */

interface Sample {
  ts: string
  cpu: number
  memPercent: number
  memUsed: number
  diskPercent: number | null
  load1: number
  load5: number
  load15: number
}

interface HostInfo {
  hostname: string
  platform: string
  release: string
  arch: string
  cores: number
  cpuModel: string
}

interface LiveSnapshot extends Sample {
  host: HostInfo
  memTotal: number
  memFree: number
  rss: number
  heapUsed: number
  heapTotal: number
  diskTotal: number | null
  diskFree: number | null
  diskMount: string | null
  netRxBytes: number | null
  netTxBytes: number | null
  uptimeSeconds: number
}

const exec = promisify(execFile)

function hostInfo(): HostInfo {
  const cpu = os.cpus()[0]
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cores: os.cpus().length,
    cpuModel: cpu ? cpu.model.trim() : '',
  }
}

interface CpuTick {
  idle: number
  irq: number
  nice: number
  sys: number
  user: number
}

/** 双采样 CPU 使用率（跨平台，os.cpus() 差值）。 */
async function cpuPercent(): Promise<number> {
  const ticks = (): CpuTick[] => os.cpus().map((c) => c.times)
  const totalOf = (ts: CpuTick[]): number => ts.reduce((s, t) => s + t.idle + t.irq + t.nice + t.sys + t.user, 0)
  const a = ticks()
  await new Promise((r) => setTimeout(r, 120))
  const b = ticks()
  const totalDelta = totalOf(b) - totalOf(a)
  const idleDelta = b.reduce((s, t, i) => s + t.idle - a[i].idle, 0)
  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((1 - idleDelta / totalDelta) * 1000) / 10))
}

/** 根分区磁盘占用（Linux/macOS 支持 statfs；Windows 返回 null）。 */
function diskUsage(): { total: number; free: number; percent: number } | null {
  try {
    const s = statfsSync('/')
    const bsize = Number(s.bsize ?? 4096)
    const total = Number(s.blocks) * bsize
    const free = Number(s.bavail) * bsize
    const used = total - free
    if (total <= 0) return null
    return { total, free, percent: Math.round((used / total) * 1000) / 10 }
  } catch {
    return null
  }
}

/** 网络收发累计字节（Linux /proc/net/dev；其余平台 null）。 */
function networkBytes(): { rxBytes: number; txBytes: number } | null {
  try {
    if (os.platform() !== 'linux' || !existsSync('/proc/net/dev')) return null
    const text = readFileSync('/proc/net/dev', 'utf8')
    let rx = 0
    let tx = 0
    for (const line of text.split('\n').slice(2)) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 10) continue
      rx += Number(cols[1]) || 0
      tx += Number(cols[9]) || 0
    }
    return { rxBytes: rx, txBytes: tx }
  } catch {
    return null
  }
}

/** Top 进程（ps，尽力而为；失败返回空数组）。 */
async function topProcesses(limit = 15): Promise<Array<{ pid: number; name: string; cpu: number; mem: number; rssBytes: number | null }>> {
  try {
    const { stdout } = await exec('ps', ['-A', '-o', 'pid=,comm=,%cpu=,%mem=,rss='], { maxBuffer: 4 * 1024 * 1024, timeout: 5000 })
    const rows: Array<{ pid: number; name: string; cpu: number; mem: number; rssBytes: number | null }> = []
    for (const line of stdout.split('\n')) {
      const cols = line.trim().split(/\s+/)
      if (cols.length < 4) continue
      const pid = Number(cols[0])
      const cpu = Number(cols[2])
      const mem = Number(cols[3])
      if (!Number.isFinite(pid) || !Number.isFinite(cpu)) continue
      const rssKb = Number(cols[4])
      rows.push({
        pid,
        name: cols[1],
        cpu,
        mem,
        rssBytes: Number.isFinite(rssKb) && rssKb > 0 ? rssKb * 1024 : null,
      })
    }
    return rows.sort((x, y) => y.cpu - x.cpu).slice(0, limit)
  } catch {
    return []
  }
}

async function collect(): Promise<LiveSnapshot> {
  const [cpu, disk, net] = await Promise.all([cpuPercent(), Promise.resolve(diskUsage()), Promise.resolve(networkBytes())])
  const memTotal = os.totalmem()
  const memFree = os.freemem()
  const memUsed = memTotal - memFree
  const load = os.loadavg()
  const usage = process.memoryUsage()
  return {
    ts: new Date().toISOString(),
    host: hostInfo(),
    cpu,
    memPercent: memTotal > 0 ? Math.round((memUsed / memTotal) * 1000) / 10 : 0,
    memUsed,
    memTotal,
    memFree,
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    diskPercent: disk?.percent ?? null,
    diskTotal: disk?.total ?? null,
    diskFree: disk?.free ?? null,
    diskMount: '/',
    netRxBytes: net?.rxBytes ?? null,
    netTxBytes: net?.txBytes ?? null,
    load1: load[0] ?? 0,
    load5: load[1] ?? 0,
    load15: load[2] ?? 0,
    uptimeSeconds: os.uptime(),
  }
}

/** 采样入历史：按分钟去重，裁剪到 historyHours。 */
async function persist(env: PluginEnvironment, s: LiveSnapshot): Promise<void> {
  const historyHours = Math.max(1, Math.min(168, Number(env.config().historyHours) || 24))
  const store = env.store()
  const list = (await store.get<Sample[]>('history')) ?? []
  const bucket = s.ts.slice(0, 16)
  const prev = list[list.length - 1]
  if (!prev || prev.ts.slice(0, 16) !== bucket) {
    list.push({
      ts: s.ts,
      cpu: s.cpu,
      memPercent: s.memPercent,
      memUsed: s.memUsed,
      diskPercent: s.diskPercent,
      load1: s.load1,
      load5: s.load5,
      load15: s.load15,
    })
  } else {
    prev.cpu = s.cpu
    prev.memPercent = s.memPercent
    prev.memUsed = s.memUsed
    prev.diskPercent = s.diskPercent
    prev.load1 = s.load1
    prev.load5 = s.load5
    prev.load15 = s.load15
  }
  const cutoff = Date.now() - historyHours * 3600_000
  const next = list.filter((x) => new Date(x.ts).getTime() >= cutoff)
  await store.put('history', next)
}

const plugin: AibasePlugin = {
  type: 'machine-monitor',
  name: '机器监控',
  describe: '部署机器性能监控：CPU/内存/磁盘/负载/进程，控制台卡片 + 应用空间详情',
  defaultDataScope: 'GLOBAL_SHARED',
  scopeOverrideAllowed: false,

  async init(env: PluginEnvironment) {
    const list = await env.store().get<Sample[]>('history')
    if (!list) await env.store().put('history', [])
    const s = await collect()
    await persist(env, s)
    env.info(`机器监控已启用：${s.host.hostname}（${s.host.platform}/${s.host.arch}，${s.host.cores} 核）`)
  },

  datasetSource: () => ({
    render: async (env) => {
      const s = await collect()
      await persist(env, s)
      return JSON.stringify(s)
    },
  }),

  endpoints: () => [
    {
      method: 'GET', path: 'status', summary: '实时性能快照（采集并入库）',
      handle: async (env) => {
        const s = await collect()
        await persist(env, s)
        return { host: s.host, sample: s }
      },
    },
    {
      method: 'GET', path: 'history/{hours}', summary: '历史采样（分钟粒度，默认 24 小时）',
      handle: async (env, params) => {
        const hours = Math.max(1, Math.min(168, Number(params.hours) || 24))
        const list = (await env.store().get<Sample[]>('history')) ?? []
        const cutoff = Date.now() - hours * 3600_000
        return list.filter((x) => new Date(x.ts).getTime() >= cutoff)
      },
    },
    {
      method: 'GET', path: 'processes', summary: 'Top 进程（按 CPU 排序）',
      handle: async () => topProcesses(15),
    },
  ],
}

export default plugin
