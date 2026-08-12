import { ElMessage } from 'element-plus'

/**
 * 复制到剪贴板：仅在写入成功时提示「已复制」；失败或 API 不可用（非安全上下文）
 * 时提示手动复制，避免无条件弹成功提示与未处理的 Promise rejection。
 */
export async function copyText(text: string, label: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      ElMessage.success(`${label}已复制`)
      return
    }
  } catch {
    // 权限拒绝 / 失败，走兜底提示
  }
  ElMessage.info(`${label}：复制失败，请手动复制`)
}