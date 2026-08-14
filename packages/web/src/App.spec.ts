import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import App from './App.vue'

/**
 * App.vue 登录刷新回归测试（review M4 / 规范 F-02）：
 * 登录前 /api/plugins/ui 会 401 静默失败，登录成功后必须重新 initPluginSlots()，
 * 否则插件 Tab / 控制台卡片 / 侧边菜单要刷新页面才出现。
 */
const initPluginSlots = vi.fn()
const get = vi.fn()

vi.mock('./plugin-host/slotRegistry', () => ({
  initPluginSlots: (...args: unknown[]) => initPluginSlots(...args),
  useSlotsOf: () => ref([]),
}))

vi.mock('./services/http', () => ({
  get: (...args: unknown[]) => get(...args),
  AUTH_TOKEN_KEY: 'atlas-token',
}))

// LoginView 桩：点击触发 authed 事件，模拟登录成功
const LoginViewStub = defineComponent({
  name: 'LoginView',
  emits: ['authed'],
  template: '<button class="do-login" @click="$emit(\'authed\')"></button>',
})

function mountApp() {
  return mount(App, {
    global: {
      // 桩组件默认不渲染插槽子节点；开启后布局树（el-container→el-aside→el-button）完整渲染，
      // 事件绑定与类名随真实组件保留，可触发登出按钮。
      renderStubDefaultSlot: true,
      stubs: {
        LoginView: LoginViewStub,
        // 其余视图 / 布局组件全部桩掉，只验证认证门与 slot 刷新逻辑
        ConsoleView: true,
        AppsView: true,
        AppSpaceView: true,
        PluginsAdminView: true,
        SecurityView: true,
        OpsView: true,
        PluginMount: true,
        'el-container': true,
        'el-aside': true,
        'el-main': true,
        'el-menu': true,
        'el-menu-item': true,
        'el-icon': true,
        'el-button': true,
      },
    },
  })
}

describe('App.vue 认证门与插件 slot 刷新', () => {
  beforeEach(() => {
    initPluginSlots.mockClear()
    get.mockClear()
    localStorage.clear()
  })

  it('未登录：渲染登录页，不渲染管理布局', () => {
    const wrapper = mountApp()
    expect(wrapper.find('.do-login').exists()).toBe(true)
    expect(wrapper.find('.layout').exists()).toBe(false)
    expect(initPluginSlots).not.toHaveBeenCalled()
  })

  it('登录成功：handleAuthed 重新拉取插件 slot（M4 回归）', async () => {
    const wrapper = mountApp()
    await wrapper.find('.do-login').trigger('click')
    await nextTick()
    expect(wrapper.find('.layout').exists()).toBe(true)
    expect(initPluginSlots).toHaveBeenCalledTimes(1)
  })

  it('退出登录：清空 token 并回落到登录页', async () => {
    localStorage.setItem('atlas-token', 'tok')
    const wrapper = mountApp()
    await wrapper.find('.do-login').trigger('click')
    expect(wrapper.find('.layout').exists()).toBe(true)
    // 触发登出：布局内唯一的 el-button 即退出按钮（桩元素保留事件绑定）
    const logoutBtn = wrapper.find('.layout el-button-stub')
    expect(logoutBtn.exists()).toBe(true)
    await logoutBtn.trigger('click')
    expect(localStorage.getItem('atlas-token')).toBeNull()
    expect(wrapper.find('.do-login').exists()).toBe(true)
    expect(wrapper.find('.layout').exists()).toBe(false)
  })
})
