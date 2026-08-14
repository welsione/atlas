import { reactive, type Component } from 'vue'

/**
 * 页头右侧操作区（页面级 action 注入）。
 *
 * 面包屑根在 App.vue 的 .ph 行；各视图需要「创建」「刷新」等右对齐主操作时，
 * 通过本模块注入当前页的 action，App.vue 在面包屑右端渲染。
 */
export interface PageHeadAction {
  /** element-plus 图标组件（可选） */
  icon?: Component
  /** 按钮文案 */
  label: string
  /** 主操作按钮（type="primary"）。默认 true。 */
  primary?: boolean
  loading?: boolean
  disabled?: boolean
  /** 点击回调 */
  onClick: () => void
  /** 是否需要 tooltip（图标按钮时） */
  tip?: string
}

const head = reactive<{ action: PageHeadAction | null }>({ action: null })

/** 视图挂载时设置当前页主操作；卸载时清空。返回清理函数（可在 onBeforeUnmount 调用）。 */
export function setPageHeadAction(action: PageHeadAction | null): () => void {
  head.action = action
  return () => {
    if (head.action === action) head.action = null
  }
}

export function usePageHeadAction() {
  return head
}
