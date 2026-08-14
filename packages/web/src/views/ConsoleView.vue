<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Monitor, Cpu, Warning, List, Box, Grid } from '@element-plus/icons-vue'
import { appApi } from '../services/appApi'
import { opsApi } from '../services/opsApi'
import { pluginApi } from '../services/pluginApi'
import PluginMount from '../plugin-host/PluginMount.vue'
import { useSlotsOf } from '../plugin-host/slotRegistry'
import type { App } from '../types'

const emit = defineEmits<{ (e: 'open-space', app: App): void }>()

const apps = ref<App[]>([])
const appTotal = ref(0)
const instanceCount = ref(0)
const overview = ref<{ levels: Record<string, number>; hourly: Array<{ bucket: string; count: number; errors: number }> }>({
  levels: { INFO: 0, WARN: 0, ERROR: 0 },
  hourly: [],
})

const consoleSlots = useSlotsOf('console')

onMounted(async () => {
  try {
    const res = await appApi.list(1, 100)
    apps.value = res.rows
    appTotal.value = res.total
    const counts = await Promise.all(apps.value.map((a) => pluginApi.overview(a.id, 1, 1).catch(() => null)))
    instanceCount.value = counts.reduce((s, r) => s + (r?.total ?? 0), 0)
  } catch {
    // 未登录
  }
  try {
    overview.value = await opsApi.overview()
  } catch {
    // 运维台暂不可用
  }
})

/** 迷你趋势条：近 6 小时请求量占比。 */
const hourlyBars = computed(() => {
  const h = overview.value.hourly.slice(-6)
  const max = Math.max(1, ...h.map((x) => x.count))
  return h.map((x) => ({ count: x.count, height: `${Math.max(8, Math.round((x.count / max) * 100))}%`, error: x.errors > 0 }))
})

const total24h = computed(() => overview.value.hourly.reduce((s, h) => s + h.count, 0))
</script>

<template>
  <div class="page">
    <!-- 统计卡（kicker + 大数字 + delta/说明 + 迷你趋势条） -->
    <div class="stats">
      <el-tooltip :content="apps.length ? `点击进入「${apps[0].name}」应用空间` : '暂无应用，先到应用管理创建'" placement="top">
        <div class="stat" role="button" tabindex="0" @click="apps[0] && emit('open-space', apps[0])" @keydown.enter.space.prevent="apps[0] && emit('open-space', apps[0])">
          <div class="kicker"><Grid class="kickic" />应用总数</div>
          <div class="num">{{ appTotal }}</div>
          <div class="fixeline"><span class="delta">↗ 本月新增</span></div>
          <div class="mini-bar"><span class="bar-seg" v-for="(b, i) in hourlyBars" :key="i" :style="{ height: b.height }" :class="{ 'is-error': b.error }"></span></div>
        </div>
      </el-tooltip>

      <div class="stat">
        <div class="kicker"><Cpu class="kickic" />插件实例</div>
        <div class="num">{{ instanceCount }}</div>
        <div class="fixeline"><span class="label">全局共享 + 应用独立</span></div>
        <div class="mini-bar"><span class="bar-seg" v-for="(b, i) in hourlyBars" :key="i" :style="{ height: b.height }" :class="{ 'is-error': b.error }"></span></div>
      </div>

      <el-tooltip content="近 7 天 ERROR 级工作日志数量（见运维台）" placement="top">
        <div class="stat">
          <div class="kicker"><Warning class="kickic" />日志告警</div>
          <div class="num" :class="{ danger: overview.levels.ERROR > 0 }">{{ overview.levels.ERROR }}</div>
          <div class="fixeline"><span class="label" :class="{ danger: overview.levels.ERROR > 0 }">近 7 天 ERROR</span></div>
          <div class="mini-bar"><span class="bar-seg" v-for="(b, i) in hourlyBars" :key="i" :style="{ height: b.height }" :class="{ 'is-error': b.error }"></span></div>
        </div>
      </el-tooltip>

      <div class="stat">
        <div class="kicker"><List class="kickic" />工作日志</div>
        <div class="num">{{ total24h }}</div>
        <div class="fixeline"><span class="label">近 24h 请求·监控</span></div>
        <div class="mini-bar"><span class="bar-seg" v-for="(b, i) in hourlyBars" :key="i" :style="{ height: b.height }" :class="{ 'is-error': b.error }"></span></div>
      </div>
    </div>

    <!-- 插件卡片区 -->
    <div class="ttl-row"><h2>插件服务</h2><span class="hint">平台内置与目录插件</span></div>
    <div v-if="consoleSlots.length" class="card-grid plugin-cards">
      <div v-for="slot in consoleSlots" :key="slot.key" class="plugin-card">
        <div class="plugin-card-head">
          <span class="ico">
            <img v-if="typeof slot.icon === 'string' && slot.icon" :src="slot.icon" class="plugin-card-icon" alt="" />
            <el-icon v-else><Box /></el-icon>
          </span>
          <div class="pcm">
            <b>{{ slot.label }}</b>
            <span class="meta"><span class="tag">已加载</span> {{ slot.pluginType }}</span>
          </div>
          <span class="arr">›</span>
        </div>
        <div class="plugin-card-body">
          <PluginMount :load="slot.load" :plugin-type="slot.pluginType" mode="console" :refresh="() => undefined" />
        </div>
      </div>
    </div>
    <div v-else class="empty-hint surface">
      <el-icon class="empty-icon"><Box /></el-icon>
      <div>当前没有插件注册控制台卡片。</div>
      <div class="empty-sub">插件在 UI manifest 的 slots 中声明 <code class="mono">slot: console</code> 后生效，与应用空间 Tab 同一机制。</div>
    </div>
  </div>
</template>

<style scoped>
/* 统计卡（demo 档位）：kicker → 大数字 → fixeline → 迷你趋势条 */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}

.stat {
  background: var(--atlas-surface);
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-m);
  padding: 18px 18px 16px;
  box-shadow: var(--atlas-shadow-card);
  transition: box-shadow 0.16s, transform 0.16s, border-color 0.16s;
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.stat:hover {
  box-shadow: var(--atlas-shadow-hover);
  transform: translateY(-1px);
  border-color: var(--atlas-stroke-strong);
}

.stat:focus-visible {
  outline: 2px solid var(--atlas-accent);
  outline-offset: 1px;
}

.stat .kicker {
  font-size: 11px;
  color: var(--atlas-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.stat .kickic {
  width: 14px;
  height: 14px;
  color: var(--atlas-accent);
  opacity: 0.75;
}

.stat .num {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.stat .num.danger {
  color: var(--atlas-danger);
}

.stat .fixeline {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 18px;
  margin-top: 6px;
}

.stat .delta {
  font-size: 11px;
  color: var(--atlas-success);
  font-weight: 600;
}

.stat .label {
  font-size: 12px;
  color: var(--atlas-muted);
  line-height: 1.3;
}

.stat .label.danger {
  color: var(--atlas-danger);
}

.stat .mini-bar {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 24px;
  margin-top: 14px;
}

.stat .mini-bar .bar-seg {
  flex: 1;
  background: var(--atlas-accent-soft);
  border-radius: 6px 6px 0 0;
  transition: height 0.2s;
}

.stat .mini-bar .bar-seg.is-error {
  background: var(--atlas-danger-soft);
}

/* 插件卡片 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.plugin-card {
  background: var(--atlas-surface);
  border: 1px solid var(--atlas-stroke);
  border-radius: var(--atlas-r-m);
  box-shadow: var(--atlas-shadow-card);
  padding: 16px;
  transition: box-shadow 0.16s, transform 0.16s, border-color 0.16s;
}

.plugin-card:hover {
  box-shadow: var(--atlas-shadow-hover);
  transform: translateY(-1px);
  border-color: var(--atlas-stroke-strong);
}

.plugin-card-head {
  display: flex;
  align-items: center;
  gap: 13px;
}

.plugin-card-head .ico {
  width: 40px;
  height: 40px;
  border-radius: var(--atlas-r-s);
  background: var(--atlas-accent-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--atlas-accent);
}

.plugin-card-head .ico .el-icon {
  font-size: 20px;
}

.plugin-card-icon {
  width: 24px;
  height: 24px;
}

.plugin-card-head .pcm {
  min-width: 0;
  flex: 1;
}

.plugin-card-head b {
  font-size: 14px;
  font-weight: 700;
  color: var(--atlas-text);
  display: block;
}

.plugin-card-head .meta {
  font-size: 11px;
  color: var(--atlas-muted);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.plugin-card-head .arr {
  color: var(--atlas-faint);
  font-size: 14px;
}

.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 20px;
  background: var(--atlas-good-soft);
  color: var(--atlas-success);
  font-weight: 600;
}

.plugin-card-body {
  margin-top: 12px;
}

/* 空状态 */
.empty-hint {
  padding: 40px 32px;
  text-align: center;
  color: var(--atlas-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  font-size: 32px;
  color: var(--atlas-accent);
  opacity: 0.5;
}

.empty-sub {
  font-size: 12px;
  color: var(--atlas-muted);
  opacity: 0.8;
}

@media (max-width: 860px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
}

@media (max-width: 520px) {
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
